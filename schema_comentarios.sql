-- Ejecuta SOLO este script en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.
-- Agrega la columna de comentarios a las notas de venta (se imprimen en la nota).

alter table notas_venta add column if not exists comentarios text;
