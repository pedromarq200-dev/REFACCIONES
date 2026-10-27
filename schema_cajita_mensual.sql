-- Cajita: gastos automáticos de cada mes (por ejemplo, la entrega a mi papá los días 15 y 30).
-- Para quien ya corrió schema_cajita.sql. Correr una vez en Supabase > SQL Editor.
--
-- No necesita ningún programador de tareas: cada vez que alguien abre la página, cajita_estado()
-- anota los gastos que ya tocaban y todavía no estaban, con la fecha en que tocaban. Así nunca
-- se salta uno aunque nadie entre en varios días.

create table if not exists cajita_recurrentes (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references cajita_personas (id),
  centavos bigint not null check (centavos > 0),
  nota text not null,
  -- Día del mes; si el mes es más corto (día 30 en febrero), se usa el último día de ese mes.
  dia int not null check (dia between 1 and 31),
  activo boolean not null default true,
  -- Último día ya revisado: solo se anotan fechas posteriores. Así, si alguien borra uno de los
  -- gastos generados, no se vuelve a crear.
  revisado_hasta date not null default ((now() at time zone 'America/Mexico_City')::date - 1),
  creado_en timestamptz not null default now()
);
alter table cajita_recurrentes enable row level security;

alter table cajita_movimientos add column if not exists recurrente_id uuid references cajita_recurrentes (id) on delete set null;

-- Fecha que le toca a un día del mes en un mes dado (recorta al último día si el mes es más corto).
create or replace function cajita_fecha_del_mes(p_mes date, p_dia int) returns date
language sql immutable as $$
  select (date_trunc('month', p_mes)::date
          + (least(p_dia, extract(day from (date_trunc('month', p_mes) + interval '1 month - 1 day'))::int) - 1));
$$;

create or replace function cajita_aplicar_recurrentes() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record; v_hoy date := (now() at time zone 'America/Mexico_City')::date; v_mes date; v_fecha date;
begin
  for r in select * from cajita_recurrentes where activo and revisado_hasta < v_hoy for update skip locked loop
    v_mes := date_trunc('month', r.revisado_hasta + 1)::date;
    while v_mes <= v_hoy loop
      v_fecha := cajita_fecha_del_mes(v_mes, r.dia);
      if v_fecha > r.revisado_hasta and v_fecha <= v_hoy then
        insert into cajita_movimientos (tipo, de, para, centavos, nota, estado, creado_en, recurrente_id)
        values ('gasto', r.de, null, r.centavos, r.nota, 'confirmado',
                (v_fecha + time '12:00') at time zone 'America/Mexico_City', r.id);
      end if;
      v_mes := (v_mes + interval '1 month')::date;
    end loop;
    update cajita_recurrentes set revisado_hasta = v_hoy where id = r.id;
  end loop;
end $$;

-- Igual que antes, pero primero anota los gastos automáticos que ya tocaban, y además
-- devuelve la lista de gastos automáticos para mostrarla en la página.
create or replace function cajita_estado() returns json
language plpgsql security definer set search_path = public as $$
begin
  perform cajita_aplicar_recurrentes();
  return json_build_object(
    'personas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre) order by creado_en)
                          from cajita_personas), '[]'::json),
    'movimientos', coalesce((select json_agg(json_build_object(
                      'id', id, 'tipo', tipo, 'de', de, 'para', para, 'centavos', centavos,
                      'nota', nota, 'estado', estado, 't', creado_en, 'auto', recurrente_id is not null)
                      order by creado_en desc)
                    from cajita_movimientos), '[]'::json),
    'recurrentes', coalesce((select json_agg(json_build_object(
                      'id', id, 'de', de, 'centavos', centavos, 'nota', nota, 'dia', dia) order by dia, creado_en)
                    from cajita_recurrentes where activo), '[]'::json)
  );
end $$;

create or replace function cajita_crear_recurrente(p_de uuid, p_pin text, p_centavos bigint, p_nota text, p_dia int) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform cajita_revisar_pin(p_de, p_pin);
  if p_centavos is null or p_centavos <= 0 or p_centavos > 100000000 then raise exception 'Cantidad no válida'; end if;
  if coalesce(btrim(p_nota), '') = '' then raise exception 'Escribe qué se paga cada mes'; end if;
  if p_dia is null or p_dia < 1 or p_dia > 31 then raise exception 'El día del mes debe ser del 1 al 31'; end if;
  if (select count(*) from cajita_recurrentes where activo) >= 30 then raise exception 'Ya hay demasiados gastos automáticos'; end if;
  insert into cajita_recurrentes (de, centavos, nota, dia) values (p_de, p_centavos, left(btrim(p_nota), 120), p_dia)
  returning id into v_id;
  return v_id;
end $$;

-- Solo quien lo creó lo puede quitar. Los gastos que ya se descontaron se quedan en el historial.
create or replace function cajita_quitar_recurrente(p_rec uuid, p_persona uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform cajita_revisar_pin(p_persona, p_pin);
  update cajita_recurrentes set activo = false where id = p_rec and de = p_persona and activo;
  if not found then raise exception 'No se puede quitar este gasto automático'; end if;
end $$;

revoke all on function cajita_aplicar_recurrentes() from public, anon, authenticated;
grant execute on function cajita_estado() to anon, authenticated;
grant execute on function cajita_crear_recurrente(uuid, text, bigint, text, int) to anon, authenticated;
grant execute on function cajita_quitar_recurrente(uuid, uuid, text) to anon, authenticated;

-- La entrega mensual de SOME PLUS a mi papá: $9,196 al mes, la mitad el 15 y la otra mitad el 30.
-- Empieza a contar desde hoy. Si SOME PLUS todavía no se ha agregado en la página, no se crea nada
-- (se puede crear después desde la página, en "Cada mes").
insert into cajita_recurrentes (de, centavos, nota, dia)
select p.id, 459800, v.nota, v.dia
  from cajita_personas p
 cross join (values (15, 'Entrega a mi papá (1ª mitad del mes)'), (30, 'Entrega a mi papá (2ª mitad del mes)')) as v(dia, nota)
 where lower(p.nombre) = 'some plus'
   and not exists (select 1 from cajita_recurrentes r where r.de = p.id and r.dia = v.dia and r.activo);

select case when exists (select 1 from cajita_personas where lower(nombre) = 'some plus')
            then 'Listo: SOME PLUS tiene sus 2 entregas automáticas (día 15 y día 30).'
            else 'Ojo: todavía no hay nadie llamado SOME PLUS en la cajita. Agrégalo en la página y vuelve a correr este archivo.'
       end as resultado;
