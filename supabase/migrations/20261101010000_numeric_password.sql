-- รหัสผ่านต้องเป็นตัวเลขล้วน อย่างน้อย 6 หลัก (หน้า login ใช้ปุ่มกดตัวเลขแบบ PIN)
create or replace function public.admin_set_password(p_account text, p_password text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_account not in ('admin', 'shop') then
    raise exception 'ไม่รู้จักบัญชี %', p_account;
  end if;
  if p_password is null or p_password !~ '^[0-9]{6,}$' then
    raise exception 'รหัสผ่านต้องเป็นตัวเลขอย่างน้อย 6 หลัก';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where email = p_account || '@pangpoint.local';

  if not found then
    raise exception 'ไม่พบบัญชี %@pangpoint.local', p_account;
  end if;
end $$;
