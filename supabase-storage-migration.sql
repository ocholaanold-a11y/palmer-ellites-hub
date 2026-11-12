-- Palmer Ellites Hub (PEH): private student order file access.
-- Run as postgres in Supabase SQL Editor AFTER supabase-schema.sql.
-- Requires private Supabase Storage bucket: peh-order-files.
-- Object path pattern: <authenticated-user-uuid>/<owned-order-uuid>/<random-safe-filename>
-- Do NOT allow public access, anonymous uploads, upserts, or arbitrary paths.

update storage.buckets
set public = false,
    file_size_limit = 5242880
where id = 'peh-order-files';

-- Students can view/download only their own order files.
-- An authorized PEH administrator can view/download files for any order.
drop policy if exists "peh order files read" on storage.objects;
create policy "peh order files read"
on storage.objects for select to authenticated
using (
  bucket_id = 'peh-order-files'
  and (
    exists (
      select 1 from public.orders o
      where o.user_id = (select auth.uid())
        and o.id::text = (storage.foldername(name))[2]
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or exists (
      select 1 from public.peh_admins a
      where a.user_id = (select auth.uid())
    )
  )
);

-- Students can upload only beneath a real order they own.
-- Limit upload to one new object at a time; no direct update policy exists.
drop policy if exists "peh students upload order files" on storage.objects;
create policy "peh students upload order files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'peh-order-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.orders o
    where o.user_id = (select auth.uid())
      and o.id::text = (storage.foldername(name))[2]
  )
);

-- Administrators may upload a deliverable only underneath an existing order.
-- Because deliverables and originals share a bucket, future staff access
-- requires more granular policies and a security review before enabling.
drop policy if exists "peh admins upload order deliverables" on storage.objects;
create policy "peh admins upload order deliverables"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'peh-order-files'
  and exists (
    select 1 from public.peh_admins a
    where a.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[2]
      and o.user_id::text = (storage.foldername(name))[1]
  )
);

-- No update or delete policies: cannot replace or remove original evidence.
-- Stored objects remain private. Never set bucket public = true.
-- Before accepting real customer files, complete consent, retention policy,
-- malicious file scanning, deletion rights, and under-18 safety review.
