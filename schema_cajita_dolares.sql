-- Cajita: entregas en dólares (por ejemplo, lo que manda César desde Estados Unidos).
-- Para quien ya corrió schema_cajita.sql y schema_cajita_mensual.sql. Correr una vez en Supabase > SQL Editor.
--
-- Quien manda anota los dólares y el tipo de cambio del día; se guarda un aproximado en pesos.
-- Quien recibe confirma cuántos pesos le llegaron de verdad (puede ser menos por comisiones),
-- y eso es lo que cuenta en la cajita.

alter table cajita_movimientos add column if not exists usd_centavos bigint check (usd_centavos > 0);
alter table cajita_movimientos add column if not exists tipo_cambio numeric(10, 4) check (tipo_cambio > 0);
alter table cajita_movimientos add column if not exists estimado_centavos bigint;

create or replace function cajita_anotar_dolares(p_de uuid, p_pin text, p_para uuid, p_usd_centavos bigint,
                                                 p_tipo_cambio numeric, p_nota text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_pesos bigint;
begin
  perform cajita_revisar_pin(p_de, p_pin);
  if p_usd_centavos is null or p_usd_centavos <= 0 or p_usd_centavos > 10000000 then raise exception 'Cantidad de dólares no válida'; end if;
  if p_tipo_cambio is null or p_tipo_cambio < 5 or p_tipo_cambio > 50 then raise exception 'Tipo de cambio no válido'; end if;
  if p_para is null or p_para = p_de then raise exception 'Elige a quién se lo mandaste'; end if;
  v_pesos := round(p_usd_centavos * p_tipo_cambio);
  insert into cajita_movimientos (tipo, de, para, centavos, nota, estado, usd_centavos, tipo_cambio, estimado_centavos)
  values ('aporte', p_de, p_para, v_pesos, left(coalesce(btrim(p_nota), ''), 120), 'pendiente',
          p_usd_centavos, round(p_tipo_cambio, 4), v_pesos)
  returning id into v_id;
  return v_id;
end $$;

-- Confirmar ahora acepta, opcionalmente, los pesos que de verdad llegaron.
drop function if exists cajita_responder(uuid, uuid, text, boolean);
create or replace function cajita_responder(p_mov uuid, p_persona uuid, p_pin text, p_recibido boolean,
                                            p_centavos bigint default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform cajita_revisar_pin(p_persona, p_pin);
  if p_recibido and p_centavos is not null and (p_centavos <= 0 or p_centavos > 100000000) then
    raise exception 'Cantidad no válida';
  end if;
  update cajita_movimientos
     set estado = case when p_recibido then 'confirmado' else 'rechazado' end,
         centavos = case when p_recibido and p_centavos is not null then p_centavos else centavos end,
         respondido_en = now()
   where id = p_mov and para = p_persona and estado = 'pendiente';
  if not found then raise exception 'Este movimiento ya no está pendiente para ti'; end if;
end $$;

-- Igual que en schema_cajita_mensual.sql, más los datos de dólares de cada movimiento.
create or replace function cajita_estado() returns json
language plpgsql security definer set search_path = public as $$
begin
  perform cajita_aplicar_recurrentes();
  return json_build_object(
    'personas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre) order by creado_en)
                          from cajita_personas), '[]'::json),
    'movimientos', coalesce((select json_agg(json_build_object(
                      'id', id, 'tipo', tipo, 'de', de, 'para', para, 'centavos', centavos,
                      'nota', nota, 'estado', estado, 't', creado_en, 'auto', recurrente_id is not null,
                      'usd', usd_centavos, 'tc', tipo_cambio, 'estimado', estimado_centavos)
                      order by creado_en desc)
                    from cajita_movimientos), '[]'::json),
    'recurrentes', coalesce((select json_agg(json_build_object(
                      'id', id, 'de', de, 'centavos', centavos, 'nota', nota, 'dia', dia) order by dia, creado_en)
                    from cajita_recurrentes where activo), '[]'::json)
  );
end $$;

grant execute on function cajita_estado() to anon, authenticated;
grant execute on function cajita_anotar_dolares(uuid, text, uuid, bigint, numeric, text) to anon, authenticated;
grant execute on function cajita_responder(uuid, uuid, text, boolean, bigint) to anon, authenticated;

select 'Listo: ya se pueden anotar entregas en dólares.' as resultado;
