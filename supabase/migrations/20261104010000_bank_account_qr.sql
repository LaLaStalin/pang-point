-- เลขบัญชีกสิกร 10 หลัก สำหรับสร้าง QR รับเงินเข้าบัญชีโดยตรง
-- แยกจาก promptpay_id เพราะเลขบัญชี 10 หลักแยกจากเบอร์โทรไม่ได้
-- ถ้ามีค่านี้ หน้าขายจะใช้เลขบัญชีก่อน ถ้าเป็น null จะกลับไปใช้ promptpay_id
alter table public.settings
  add column kbank_account text
  check (kbank_account ~ '^[0-9]{10}$');
