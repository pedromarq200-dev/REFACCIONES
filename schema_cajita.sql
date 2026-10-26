-- Cajita para mis papás: control del dinero que los hermanos juntan (página /cajita/).
--
-- A diferencia del resto de la app, esta página se usa SIN iniciar sesión, desde cualquier celular.
-- Por eso las tablas no tienen ninguna política para el navegador (RLS activo y cerrado): nadie las
-- puede leer ni escribir directamente con la anon key. Todo pasa por las funciones de abajo
-- (security definer), que revisan el PIN de cada persona antes de anotar, confirmar o borrar.
--
-- Correr una sola vez en Supabase > SQL Editor. No toca ninguna tabla de las notas de venta.

create extension if not exists pgcrypto;

create table if not exists cajita_personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pin_hash text not null,
  creado_en timestamptz not null default now()
);
create unique index if not exists cajita_personas_nombre_idx on cajita_personas (lower(nombre));

create table if not exists cajita_movimientos (
  id uuid primary key default gen_random_uuid(),
  -- aporte: alguien da dinero nuevo a quien lo guarda (puede ser él mismo: queda confirmado al momento)
  -- gasto: quien guarda dinero paga algo con él
  -- traspaso: quien guarda dinero se lo pasa a otra persona
  tipo text not null check (tipo in ('aporte', 'gasto', 'traspaso')),
  de uuid not null references cajita_personas (id),
  para uuid references cajita_personas (id),
  centavos bigint not null check (centavos > 0),
  nota text not null default '',
  estado text not null check (estado in ('pendiente', 'confirmado', 'rechazado')),
  creado_en timestamptz not null default now(),
  respondido_en timestamptz,
  check ((tipo = 'gasto') = (para is null))
);

alter table cajita_personas enable row level security;
alter table cajita_movimientos enable row level security;

-- Revisa el PIN de una persona; lanza error si no coincide.
create or replace function cajita_revisar_pin(p_persona uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from cajita_personas
                 where id = p_persona and pin_hash = crypt(p_pin, pin_hash)) then
    raise exception 'PIN incorrecto';
  end if;
end $$;

-- Todo lo que la página necesita para dibujarse (sin los PIN).
create or replace function cajita_estado() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'personas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre) order by creado_en)
                          from cajita_personas), '[]'::json),
    'movimientos', coalesce((select json_agg(json_build_object(
                      'id', id, 'tipo', tipo, 'de', de, 'para', para, 'centavos', centavos,
                      'nota', nota, 'estado', estado, 't', creado_en) order by creado_en desc)
                    from cajita_movimientos), '[]'::json)
  );
$$;

create or replace function cajita_agregar_persona(p_nombre text, p_pin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
begin
  if length(v_nombre) < 1 or length(v_nombre) > 40 then raise exception 'Escribe un nombre de hasta 40 letras'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener 4 números'; end if;
  if exists (select 1 from cajita_personas where lower(nombre) = lower(v_nombre)) then
    raise exception 'Ese nombre ya está en la lista';
  end if;
  if (select count(*) from cajita_personas) >= 30 then raise exception 'Ya hay demasiadas personas'; end if;
  insert into cajita_personas (nombre, pin_hash) values (v_nombre, crypt(p_pin, gen_salt('bf')))
  returning id into v_id;
  return v_id;
end $$;

-- Sirve para "entrar" en otro celular: confirma que el PIN es de esa persona.
create or replace function cajita_entrar(p_persona uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform cajita_revisar_pin(p_persona, p_pin);
  return true;
end $$;

create or replace function cajita_anotar(p_de uuid, p_pin text, p_tipo text, p_para uuid,
                                         p_centavos bigint, p_nota text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform cajita_revisar_pin(p_de, p_pin);
  if p_centavos is null or p_centavos <= 0 or p_centavos > 100000000 then raise exception 'Cantidad no válida'; end if;
  if p_tipo = 'gasto' and coalesce(btrim(p_nota), '') = '' then raise exception 'Escribe qué pagaste'; end if;
  if p_tipo = 'traspaso' and p_para = p_de then raise exception 'No puedes pasarte dinero de tu cajita a ti mismo'; end if;
  insert into cajita_movimientos (tipo, de, para, centavos, nota, estado)
  values (p_tipo, p_de, case when p_tipo = 'gasto' then null else p_para end, p_centavos,
          left(coalesce(btrim(p_nota), ''), 120),
          case when p_tipo = 'gasto' or p_para = p_de then 'confirmado' else 'pendiente' end)
  returning id into v_id;
  return v_id;
end $$;

-- Solo quien RECIBIÓ el dinero puede confirmarlo o rechazarlo, con su PIN.
create or replace function cajita_responder(p_mov uuid, p_persona uuid, p_pin text, p_recibido boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform cajita_revisar_pin(p_persona, p_pin);
  update cajita_movimientos
     set estado = case when p_recibido then 'confirmado' else 'rechazado' end, respondido_en = now()
   where id = p_mov and para = p_persona and estado = 'pendiente';
  if not found then raise exception 'Este movimiento ya no está pendiente para ti'; end if;
end $$;

-- Quien lo anotó puede borrarlo: un gasto o lo que se anotó a sí mismo siempre, una entrega solo mientras no esté confirmada.
create or replace function cajita_borrar(p_mov uuid, p_persona uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform cajita_revisar_pin(p_persona, p_pin);
  delete from cajita_movimientos
   where id = p_mov and de = p_persona
     and (tipo = 'gasto' or para = de or estado <> 'confirmado');
  if not found then raise exception 'No se puede borrar este movimiento'; end if;
end $$;

revoke all on function cajita_revisar_pin(uuid, text) from public, anon, authenticated;
grant execute on function cajita_estado() to anon, authenticated;
grant execute on function cajita_agregar_persona(text, text) to anon, authenticated;
grant execute on function cajita_entrar(uuid, text) to anon, authenticated;
grant execute on function cajita_anotar(uuid, text, text, uuid, bigint, text) to anon, authenticated;
grant execute on function cajita_responder(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function cajita_borrar(uuid, uuid, text) to anon, authenticated;
