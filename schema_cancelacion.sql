-- Agrega la función de cancelar una nota de venta: se queda guardada (no se borra), su total
-- pasa a $0 automáticamente en toda la app (listas, Empresa, Conciliar pagos, Estado de cuenta)
-- sin tocar sus piezas, se guarda el motivo de la cancelación, y se puede reactivar después si
-- se necesita "regresarla" — recupera su importe original tal cual estaba.
--
-- Ejecuta este script completo en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.

alter table notas_venta add column if not exists cancelada boolean not null default false;
alter table notas_venta add column if not exists motivo_cancelacion text;
alter table notas_venta add column if not exists cancelada_en timestamptz;
alter table notas_venta add column if not exists cancelada_por text;
