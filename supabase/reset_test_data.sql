-- ล้างข้อมูลทดสอบ: รันใน Supabase SQL Editor
-- ทั้งสองแบบเก็บไว้: บัญชีผู้ใช้ (profiles / auth.users), settings (พร้อมเพย์)
--
-- แบบ A: ล้างทุกอย่าง รวมรายการขนม ราคา และรายชื่อร้านที่ซื้อ
-- แบบ B: ล้างเฉพาะข้อมูล stock และยอดขาย แต่เก็บราคาและรายชื่อร้านที่ซื้อไว้
--
-- รันทีละแบบเท่านั้น: ไฟล์นี้เปิดแบบ B ไว้ ถ้าจะใช้แบบ A ให้คอมเมนต์แบบ B แล้วเปิดส่วนแบบ A

-- ---------------------------------------------------------------------------
-- แบบ A: ล้างทุกอย่างรวมรายการขนม (คอมเมนต์แบบ B ไว้ก่อนแล้วเปิดส่วนนี้)
-- ---------------------------------------------------------------------------
-- truncate table
--   public.sale_items,
--   public.sales,
--   public.stock_purchases,
--   public.stock_adjustment_requests,
--   public.stock_adjustments,
--   public.stock_movement_log,
--   public.product_costs,
--   public.products,
--   public.suppliers
-- restart identity;

-- ---------------------------------------------------------------------------
-- แบบ B: ล้างข้อมูล stock แต่เก็บการตั้งค่าไว้
-- เก็บไว้: ที่ตั้งไว้ในหน้าตั้งค่า คือรายการขนมและราคาขาย (ปลีก/ส่ง และราคา "อื่นๆ"), รายชื่อร้านที่ซื้อ
-- ล้าง: ทุกอย่างที่เกิดจากการเพิ่ม stock คือประวัติรับของ, จำนวนคงเหลือ, ต้นทุนเฉลี่ย
--       และบิลขาย, ประวัติตัด stock, คำขอตัด stock, ประวัติ stock
-- หมายเหตุ: ชื่อร้านที่พิมพ์ใหม่ตอนเพิ่ม stock ถูกบันทึกลงรายชื่อร้านด้วย จึงแยกจากที่ตั้งเองไม่ได้และจะยังอยู่
-- ---------------------------------------------------------------------------
truncate table
  public.sale_items,
  public.sales,
  public.stock_purchases,
  public.stock_adjustment_requests,
  public.stock_adjustments,
  public.stock_movement_log
restart identity;
update public.products set qty_on_hand = 0;
update public.product_costs set avg_cost = 0;