-- Arregla que el folio interno (NV-0001, NV-0002...) se pudiera repetir en dos notas distintas.
-- Antes, la app calculaba "el siguiente número" viendo cuál era el folio más alto que tenía
-- cargado en ese momento el celular/computadora — si se creaban dos notas casi al mismo tiempo
-- desde dispositivos distintos (o el mismo dispositivo no se había alcanzado a actualizar con la
-- nota más reciente), los dos podían calcular el mismo "siguiente" número.
--
-- Ahora el folio lo asigna la base de datos con una secuencia, que sí garantiza un número
-- distinto cada vez sin importar cuántos dispositivos estén guardando notas al mismo tiempo.
--
-- Ejecuta este script completo en Supabase: Panel del proyecto > SQL Editor > New query > pega y
-- RUN. Es seguro correrlo aunque ya tengas notas guardadas: no las toca, solo hace que las nuevas
-- ya no puedan repetir folio.

create sequence if not exists notas_venta_folio_seq;

-- Arranca la secuencia después del folio más alto que ya tengas, para no repetir ninguno.
select setval(
  'notas_venta_folio_seq',
  coalesce((select max(nullif(regexp_replace(folio_interno, '\D', '', 'g'), '')::bigint) from notas_venta), 0)
);

create or replace function asignar_folio_interno()
returns trigger as $$
begin
  if new.folio_interno is null or new.folio_interno = '' then
    new.folio_interno := 'NV-' || lpad(nextval('notas_venta_folio_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_asignar_folio_interno on notas_venta;
create trigger trg_asignar_folio_interno
  before insert on notas_venta
  for each row
  execute function asignar_folio_interno();
