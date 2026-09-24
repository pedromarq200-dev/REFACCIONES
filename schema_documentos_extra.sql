-- Ejecuta SOLO este script en Supabase: Panel del proyecto > SQL Editor > New query > pega y RUN.
-- Permite anexar documentos adicionales (fotos o PDFs) a una nota, ej. evidencia de una
-- modificación posterior, más allá de la orden de compra y la evidencia de entrega.

alter table notas_venta add column if not exists documentos_extra jsonb not null default '[]';

insert into storage.buckets (id, name, public)
values ('documentos-extra', 'documentos-extra', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'usuarios autenticados: acceso total a documentos extra'
  ) then
    create policy "usuarios autenticados: acceso total a documentos extra"
      on storage.objects for all
      using (bucket_id = 'documentos-extra' and auth.role() = 'authenticated')
      with check (bucket_id = 'documentos-extra' and auth.role() = 'authenticated');
  end if;
end $$;
