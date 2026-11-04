-- ให้แอดมินเลือกเองว่า QR หน้าขายใช้พร้อมเพย์หรือบัญชีกสิกร
-- เก็บเลขทั้งสองแบบไว้ จึงสลับไปมาได้โดยไม่ต้องกรอกใหม่
alter table public.settings
  add column qr_method text not null default 'promptpay'
  check (qr_method in ('promptpay', 'kbank'));

-- ถ้ากรอกเลขบัญชีไว้แล้ว ให้ใช้เลขบัญชีต่อเหมือนเดิม
update public.settings set qr_method = 'kbank' where kbank_account is not null;

-- เลือกบัญชีกสิกรได้ก็ต่อเมื่อมีเลขบัญชี
alter table public.settings
  add constraint settings_kbank_needs_account
  check (qr_method <> 'kbank' or kbank_account is not null);
