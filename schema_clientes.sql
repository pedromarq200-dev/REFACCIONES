-- Ejecuta SOLO este script (ya corriste schema.sql antes) en Supabase:
-- Panel del proyecto > SQL Editor > New query > pega y RUN.
-- Agrega el catálogo de Clientes.

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  clave text,
  razon_social text not null,
  rfc text,
  regimen_fiscal text,
  metodo_pago text default 'PUE',
  uso_cfdi text,
  forma_pago text,
  correo text,
  codigo_postal text,
  pais_residencia text default 'México',
  calle text,
  numero_exterior text,
  numero_interior text,
  colonia text,
  municipio text,
  estado text,
  alta_pos boolean not null default false,
  activo boolean not null default true,
  telefono text,
  creado_en timestamptz not null default now()
);

alter table clientes enable row level security;

create policy "usuarios autenticados: acceso total a clientes"
  on clientes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table clientes;
