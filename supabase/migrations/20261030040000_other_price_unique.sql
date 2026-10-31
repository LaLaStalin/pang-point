-- ราคา "อื่นๆ" ห้ามซ้ำ รวมถึงราคาที่ซ่อนไว้ด้วย
-- (เดิมเช็คซ้ำเฉพาะราคาที่แสดงอยู่ จึงซ่อน 80 แล้วเพิ่ม 80 ใหม่ได้ กลายเป็น 80 สองอัน)
-- รันต่อจาก 20261030030000_suppliers.sql

-- ลบราคาที่ซ้ำ โดยเก็บอันที่แสดงอยู่ (ถ้ามี) หรืออันที่สร้างก่อน
-- ลบเฉพาะอันที่ยังไม่มีประวัติซื้อ/ขาย/ตัด stock ถ้ามีประวัติ สร้าง index ด้านล่างจะ error ให้แก้เอง
delete from public.products p
using (
  select id, row_number() over (partition by retail_price order by is_active desc, id) as rn
  from public.products
  where kind = 'other'
) d
where p.id = d.id
  and d.rn > 1
  and not exists (select 1 from public.stock_purchases where product_id = p.id)
  and not exists (select 1 from public.sale_items where product_id = p.id)
  and not exists (select 1 from public.stock_adjustments where product_id = p.id);

drop index public.products_other_price_uniq;
create unique index products_other_price_uniq on public.products (retail_price) where kind = 'other';
