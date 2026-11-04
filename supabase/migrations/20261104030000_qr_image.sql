-- เปลี่ยนตัวเลือกที่สองของ QR จากเลขบัญชีกสิกรเป็นรูป QR ที่แอดมินอัปโหลด
-- เพราะแอปธนาคารสแกน QR ที่สร้างจากเลขบัญชีไม่ได้

alter table public.settings drop constraint settings_kbank_needs_account;
alter table public.settings drop constraint settings_qr_method_check;

update public.settings set qr_method = 'promptpay' where qr_method = 'kbank';

alter table public.settings drop column kbank_account;
alter table public.settings add column qr_image_path text;

alter table public.settings
  add constraint settings_qr_method_check check (qr_method in ('promptpay', 'image'));

-- เลือกแบบรูปภาพได้ก็ต่อเมื่อมีรูปแล้ว
alter table public.settings
  add constraint settings_image_needs_path
  check (qr_method <> 'image' or qr_image_path is not null);

-- รูป QR มีไว้ให้ลูกค้าเห็นอยู่แล้ว จึงเปิดอ่านผ่าน URL ได้ แต่แอดมินเท่านั้นที่แก้ไขได้
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "payment-qr: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-qr' and (select public.is_admin()));
create policy "payment-qr: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-qr' and (select public.is_admin()));
create policy "payment-qr: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-qr' and (select public.is_admin()));
