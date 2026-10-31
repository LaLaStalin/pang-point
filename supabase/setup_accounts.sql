-- สร้าง (หรือรีเซ็ตรหัสผ่าน) 2 บัญชีของร้าน — รันใน Supabase SQL Editor หลังรัน migrations ครบแล้ว
--
--   ปุ่ม "แอดมิน"   -> admin@pangpoint.local  (เห็นทุกหน้า)
--   ปุ่ม "หน้าร้าน" -> shop@pangpoint.local   (เห็นเฉพาะหน้าขาย)
--
-- 1) แก้รหัสผ่าน 2 บรรทัดด้านล่าง (อย่างน้อย 6 ตัว)
-- 2) กด Run
-- 3) ไม่ต้องเก็บไฟล์ที่ใส่รหัสจริงไว้ / อย่า commit — ภายหลังเปลี่ยนรหัสได้ในเว็บ (จัดการร้าน → รหัสผ่าน)
-- รันซ้ำได้: ถ้ามีบัญชีอยู่แล้วจะเปลี่ยนเป็นรหัสใหม่

do $$
declare
  v_admin_password text := 'CHANGE_ME_ADMIN';   -- รหัสของแอดมิน
  v_shop_password  text := 'CHANGE_ME_SHOP';   -- รหัสของหน้าร้าน

  v_account record;
  v_id uuid;
begin
  for v_account in
    select * from (values
      ('admin@pangpoint.local', v_admin_password, 'admin', 'แอดมิน',   'admin'::public.user_role),
      ('shop@pangpoint.local',  v_shop_password,  'shop',  'หน้าร้าน', 'staff'::public.user_role)
    ) as t(email, password, username, display_name, role)
  loop
    if v_account.password like 'CHANGE_ME%' or length(v_account.password) < 6 then
      raise exception 'กรุณาแก้รหัสผ่านของ % ก่อนรัน (อย่างน้อย 6 ตัว)', v_account.email;
    end if;

    select id into v_id from auth.users where email = v_account.email;

    if v_id is null then
      v_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_account.email,
        extensions.crypt(v_account.password, extensions.gen_salt('bf')), now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', v_account.role),
        jsonb_build_object('username', v_account.username, 'display_name', v_account.display_name),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), v_id, v_id::text, 'email',
        jsonb_build_object('sub', v_id::text, 'email', v_account.email, 'email_verified', true),
        now(), now(), now()
      );
    else
      update auth.users
      set encrypted_password = extensions.crypt(v_account.password, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_id;
    end if;

    -- เผื่อบัญชีถูกสร้างไว้ก่อนรัน migration (ยังไม่มี profile) หรือ role ไม่ตรง
    insert into public.profiles (id, username, display_name, role)
    values (v_id, v_account.username, v_account.display_name, v_account.role)
    on conflict (id) do update
      set username = excluded.username,
          display_name = excluded.display_name,
          role = excluded.role;
  end loop;
end $$;

select p.username, p.display_name, p.role, u.email
from public.profiles p
    join auth.users u on u.id = p.id
order by p.role;