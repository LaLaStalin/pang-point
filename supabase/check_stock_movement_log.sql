-- ตรวจว่า stock_movement_log ตรงกับข้อมูลต้นทาง (view stock_movements): รันใน Supabase SQL Editor
-- ควรได้ only_in_view = 0 และ only_in_log = 0
with v as (
  select kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id, supplier, adjustment_id
  from public.stock_movements
),
l as (
  select kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id, supplier, adjustment_id
  from public.stock_movement_log
)
select
  (select count(*) from (select * from v except all select * from l) x) as only_in_view,
  (select count(*) from (select * from l except all select * from v) x) as only_in_log,
  (select count(*) from v) as view_rows,
  (select count(*) from l) as log_rows;
