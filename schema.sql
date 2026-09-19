-- Ejecuta este script completo en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.

create table if not exists notas_venta (
  id uuid primary key default gen_random_uuid(),
  folio_interno text not null,
  fecha date not null,
  cliente text not null,
  rfc text,
  domicilio text,
  oi text,
  folio_compra text,
  entrega text,
  placas text,
  vehiculo text,
  items jsonb not null default '[]',
  iva_pct numeric not null default 16,
  estatus text not null default 'pendiente' check (estatus in ('pendiente', 'entregada')),
  fecha_entrega date,
  recibio_nombre text,
  observaciones_entrega text,
  creado_por text,
  creado_en timestamptz not null default now()
);

create table if not exists negocio_config (
  id int primary key default 1,
  business_name text not null default 'PEDRO DAMIAN MARQUEZ LOZA',
  constraint solo_una_fila check (id = 1)
);
insert into negocio_config (id, business_name) values (1, 'PEDRO DAMIAN MARQUEZ LOZA')
  on conflict (id) do nothing;

alter table notas_venta enable row level security;
alter table negocio_config enable row level security;

-- Cualquier usuario que haya iniciado sesión (los que crees en Authentication > Users)
-- puede ver y modificar todas las notas y la configuración del negocio.
create policy "usuarios autenticados: acceso total a notas"
  on notas_venta for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "usuarios autenticados: acceso total a config"
  on negocio_config for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Para que la lista se actualice en vivo entre dispositivos.
alter publication supabase_realtime add table notas_venta;

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

alter table sucursales enable row level security;

create policy "usuarios autenticados: acceso total a sucursales"
  on sucursales for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table sucursales;
