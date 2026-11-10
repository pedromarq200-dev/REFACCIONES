-- Bucket de Storage para la foto de evidencia de una devolución (ej. la pieza defectuosa que
-- regresó el cliente). Se guarda dentro del propio registro de la devolución (columna
-- "devoluciones" de notas_venta, ya creada por schema_devoluciones.sql) -- este bucket es nada
-- más para las fotos. Corre esto una sola vez en Supabase: SQL Editor > New query > pega y RUN.

insert into storage.buckets (id, name, public)
values ('evidencias-devolucion', 'evidencias-devolucion', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'usuarios autenticados: acceso total a evidencias de devolucion'
  ) then
    create policy "usuarios autenticados: acceso total a evidencias de devolucion"
      on storage.objects for all
      using (bucket_id = 'evidencias-devolucion' and auth.role() = 'authenticated')
      with check (bucket_id = 'evidencias-devolucion' and auth.role() = 'authenticated');
  end if;
end $$;
