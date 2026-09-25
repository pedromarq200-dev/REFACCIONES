-- Ejecuta SOLO este script en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.
-- Agrega la columna para conciliar pagos (marcar una nota como pagada).

alter table notas_venta add column if not exists pagado boolean not null default false;
