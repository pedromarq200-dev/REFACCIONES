-- Cajita: permitir que alguien anote dinero que pone y se queda guardando él mismo.
-- Para quien ya corrió schema_cajita.sql. Correr una vez en Supabase > SQL Editor.
--
-- Una aportación a uno mismo queda confirmada al momento (no hay nadie más que la confirme).
-- Un traspaso a uno mismo sigue sin tener sentido y se rechaza.

-- Quita la regla "para <> de" (se creó sin nombre, así que se busca por su definición).
do $$
declare v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
     where conrelid = 'cajita_movimientos'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%para <> de%'
  loop
    execute format('alter table cajita_movimientos drop constraint %I', v_nombre);
  end loop;
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

-- Lo que uno se anotó a sí mismo se puede borrar siempre, igual que un gasto.
create or replace function cajita_borrar(p_mov uuid, p_persona uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform cajita_revisar_pin(p_persona, p_pin);
  delete from cajita_movimientos
   where id = p_mov and de = p_persona
     and (tipo = 'gasto' or para = de or estado <> 'confirmado');
  if not found then raise exception 'No se puede borrar este movimiento'; end if;
end $$;
