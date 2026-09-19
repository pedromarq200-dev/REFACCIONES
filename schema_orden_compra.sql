-- Guarda el archivo original de la orden de compra del cliente (PDF o foto) junto con cada nota,
-- para poder imprimirlo junto con la nota. Corre esto una sola vez en Supabase: Panel del proyecto
-- > SQL Editor > New query > pega y RUN.

alter table notas_venta add column if not exists orden_compra_url text;
alter table notas_venta add column if not exists orden_compra_tipo text;

insert into storage.buckets (id, name, public)
values ('ordenes-compra', 'ordenes-compra', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'usuarios autenticados: acceso total a ordenes de compra'
  ) then
    create policy "usuarios autenticados: acceso total a ordenes de compra"
      on storage.objects for all
      using (bucket_id = 'ordenes-compra' and auth.role() = 'authenticated')
      with check (bucket_id = 'ordenes-compra' and auth.role() = 'authenticated');
  end if;
end $$;
