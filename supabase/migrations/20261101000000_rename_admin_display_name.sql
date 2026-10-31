-- เปลี่ยนชื่อที่แสดงของบัญชี admin จาก "แม่/ครอบครัว" เป็น "แอดมิน"
-- (ชื่อนี้ขึ้นที่มุมขวาบน และช่อง ผู้ขาย/โดย ในหน้าประวัติ)
-- รันต่อจาก 20261030040000_other_price_unique.sql

update public.profiles
set display_name = 'แอดมิน'
where role = 'admin'
  and display_name = 'แม่/ครอบครัว';
