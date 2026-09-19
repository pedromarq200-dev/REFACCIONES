-- Ejecuta SOLO este script en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.
-- Agrega la columna RFC a las notas de venta (seguro de correr aunque ya exista).

alter table notas_venta add column if not exists rfc text;
