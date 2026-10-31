-- ล้างข้อมูลทดสอบ: รันใน Supabase SQL Editor
-- เก็บไว้: บัญชีผู้ใช้ (profiles / auth.users), settings
-- ล้าง: บิลขาย, ประวัติรับของ / ตัด stock, ต้นทุน, รายชื่อร้านที่ซื้อ, ราคา "อื่นๆ"
--       และรายการขนมทั้งหมด (เลข id เริ่มนับ 1 ใหม่)
--
-- ถ้าอยากเก็บรายการขนมไว้ แค่ล้างยอดขาย/stock ให้ใช้ส่วน "แบบ B" แทน

-- ---------------------------------------------------------------------------
-- แบบ A: ล้างทุกอย่างรวมรายการขนม
-- ---------------------------------------------------------------------------
truncate table
  public.sale_items,
  public.sales,
  public.stock_purchases,
  public.stock_adjustments,
  public.product_costs,
  public.products,
  public.suppliers
restart identity;

-- ---------------------------------------------------------------------------
-- แบบ B: เก็บรายการขนมแบบมีราคาปลีก/ส่งไว้ ล้างที่เหลือ (คอมเมนต์แบบ A ไว้ก่อนแล้วเปิดส่วนนี้)
-- ---------------------------------------------------------------------------
-- truncate table
--   public.sale_items,
--   public.sales,
--   public.stock_purchases,
--   public.stock_adjustments,
--   public.suppliers
-- restart identity;
-- delete from public.products where kind = 'other';  -- ราคา "อื่นๆ" ที่เคยตั้ง
-- update public.products set qty_on_hand = 0;
-- update public.product_costs set avg_cost = 0;
