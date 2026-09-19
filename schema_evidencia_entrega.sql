-- Guarda la foto tomada con la cámara como evidencia de entrega de cada nota. Corre esto una
-- sola vez en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.

alter table notas_venta add column if not exists evidencia_entrega_url text;

insert into storage.buckets (id, name, public)
values ('evidencias-entrega', 'evidencias-entrega', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'usuarios autenticados: acceso total a evidencias de entrega'
  ) then
    create policy "usuarios autenticados: acceso total a evidencias de entrega"
      on storage.objects for all
      using (bucket_id = 'evidencias-entrega' and auth.role() = 'authenticated')
      with check (bucket_id = 'evidencias-entrega' and auth.role() = 'authenticated');
  end if;
end $$;
