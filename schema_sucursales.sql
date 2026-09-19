-- Ejecuta SOLO este script (ya corriste schema.sql y schema_clientes.sql antes) en Supabase:
-- Panel del proyecto > SQL Editor > New query > pega y RUN.
-- Agrega las sucursales por cliente (a dónde se puede entregar), con su dirección completa.
-- Seguro de volver a correr aunque ya lo hayas ejecutado antes (agrega las columnas nuevas si faltan).

create table if not exists sucursales (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  calle text,
  numero_exterior text,
  colonia text,
  municipio text,
  codigo_postal text,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table sucursales add column if not exists calle text;
alter table sucursales add column if not exists numero_exterior text;
alter table sucursales add column if not exists colonia text;
alter table sucursales add column if not exists codigo_postal text;

alter table sucursales enable row level security;

drop policy if exists "usuarios autenticados: acceso total a sucursales" on sucursales;
create policy "usuarios autenticados: acceso total a sucursales"
  on sucursales for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sucursales'
  ) then
    alter publication supabase_realtime add table sucursales;
  end if;
end $$;
