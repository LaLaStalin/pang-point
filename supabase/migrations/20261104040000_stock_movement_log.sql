-- ลดงานของหน้าที่ข้อมูลเยอะ
-- 1) ตาราง stock_movement_log แทนการอ่านจาก view stock_movements ที่ต้องรวมและเรียงข้อมูลทั้งช่วงทุกครั้ง
-- 2) จำกัดช่วงวันที่ของ sales_summary ไม่เกิน 1 ปี
-- 3) sales_page_summary ยอดสรุปแบบเบาสำหรับหน้าประวัติการขาย
-- 4) supplier_rounds แบ่งหน้ารอบการซื้อตามรอบ
--
-- ควรรันตอนไม่มีการขายหรือรับของ เพราะมีขั้นคัดลอกข้อมูลเดิม
-- view stock_movements ยังเก็บไว้ เพื่อเทียบความถูกต้องด้วย supabase/check_stock_movement_log.sql

-- ---------------------------------------------------------------------------
-- 1) ตารางประวัติ stock (เขียนโดย trigger เท่านั้น)
-- ---------------------------------------------------------------------------
-- ไม่ผูก foreign key เพราะเป็นสำเนาสำหรับอ่าน ข้อมูลจริงอยู่ที่ตารางต้นทาง
create table public.stock_movement_log (
  id bigint generated always as identity primary key,
  kind text not null,
  category text generated always as (case when kind like 'adjust\_%' then 'adjust' else kind end) stored,
  at timestamptz not null,
  product_id bigint not null,
  qty_change integer not null,
  unit_cost numeric(12, 4) not null,
  note text,
  user_id uuid,
  sale_id bigint,
  supplier text,
  adjustment_id bigint,
  purchase_id bigint
);

create index stock_movement_log_at_idx on public.stock_movement_log (at desc, id);
create index stock_movement_log_category_idx on public.stock_movement_log (category, at desc, id);
create index stock_movement_log_adjustment_idx on public.stock_movement_log (adjustment_id) where adjustment_id is not null;
create index stock_movement_log_purchase_idx on public.stock_movement_log (purchase_id) where purchase_id is not null;

-- มีต้นทุนอยู่ในตาราง จึงให้แอดมินอ่านได้อย่างเดียว ไม่มีใครเขียนตรงผ่าน API ได้
alter table public.stock_movement_log enable row level security;
revoke all on public.stock_movement_log from anon, authenticated;
grant select on public.stock_movement_log to authenticated;
create policy "stock_movement_log: admin read" on public.stock_movement_log
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- trigger: ทำใน transaction เดียวกับรายการต้นทาง ประวัติจึงไม่ตกหล่น
-- ---------------------------------------------------------------------------
create function public._log_purchase() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into stock_movement_log (kind, at, product_id, qty_change, unit_cost, note, user_id, supplier, purchase_id)
  values ('purchase', new.created_at, new.product_id, new.qty, new.unit_cost, new.note, new.created_by, new.supplier, new.id);
  return null;
end $$;

-- เปลี่ยนชื่อร้าน (rename_supplier) ต้องให้ประวัติเปลี่ยนตาม
create function public._log_purchase_supplier() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update stock_movement_log set supplier = new.supplier where purchase_id = new.id;
  return null;
end $$;

create function public._log_sale_item() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into stock_movement_log (kind, at, product_id, qty_change, unit_cost, user_id, sale_id)
  select 'sale', s.sold_at, new.product_id, -new.qty, new.unit_cost, s.sold_by, s.id
  from sales s where s.id = new.sale_id;
  return null;
end $$;

create function public._log_sale_void() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into stock_movement_log (kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id)
  select 'void', coalesce(new.voided_at, now()), si.product_id, si.qty, si.unit_cost, new.void_reason, new.voided_by, new.id
  from sale_items si where si.sale_id = new.id
  order by si.id;
  return null;
end $$;

create function public._log_adjustment() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into stock_movement_log (kind, at, product_id, qty_change, unit_cost, note, user_id, adjustment_id)
  values ('adjust_' || new.reason::text, new.created_at, new.product_id, -new.qty, new.unit_cost, new.note, new.created_by, new.id);
  return null;
end $$;

-- แก้ประเภทรายการตัด stock ย้อนหลัง (update_adjustment_reason) ต้องให้ประวัติเปลี่ยนตาม
create function public._log_adjustment_change() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update stock_movement_log
  set kind = 'adjust_' || new.reason::text, note = new.note
  where adjustment_id = new.id;
  return null;
end $$;

revoke execute on function public._log_purchase() from public, anon, authenticated;
revoke execute on function public._log_purchase_supplier() from public, anon, authenticated;
revoke execute on function public._log_sale_item() from public, anon, authenticated;
revoke execute on function public._log_sale_void() from public, anon, authenticated;
revoke execute on function public._log_adjustment() from public, anon, authenticated;
revoke execute on function public._log_adjustment_change() from public, anon, authenticated;

create trigger log_purchase after insert on public.stock_purchases
  for each row execute function public._log_purchase();
create trigger log_purchase_supplier after update of supplier on public.stock_purchases
  for each row when (old.supplier is distinct from new.supplier)
  execute function public._log_purchase_supplier();
create trigger log_sale_item after insert on public.sale_items
  for each row execute function public._log_sale_item();
create trigger log_sale_void after update of status on public.sales
  for each row when (old.status <> 'void' and new.status = 'void')
  execute function public._log_sale_void();
create trigger log_adjustment after insert on public.stock_adjustments
  for each row execute function public._log_adjustment();
create trigger log_adjustment_change after update of reason, note on public.stock_adjustments
  for each row when (old.reason is distinct from new.reason or old.note is distinct from new.note)
  execute function public._log_adjustment_change();

-- ---------------------------------------------------------------------------
-- คัดลอกข้อมูลเดิม
-- ---------------------------------------------------------------------------
insert into public.stock_movement_log (kind, at, product_id, qty_change, unit_cost, note, user_id, supplier, purchase_id)
select 'purchase', sp.created_at, sp.product_id, sp.qty, sp.unit_cost, sp.note, sp.created_by, sp.supplier, sp.id
from public.stock_purchases sp
order by sp.id;

insert into public.stock_movement_log (kind, at, product_id, qty_change, unit_cost, user_id, sale_id)
select 'sale', s.sold_at, si.product_id, -si.qty, si.unit_cost, s.sold_by, s.id
from public.sale_items si join public.sales s on s.id = si.sale_id
order by si.id;

insert into public.stock_movement_log (kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id)
select 'void', coalesce(s.voided_at, s.sold_at), si.product_id, si.qty, si.unit_cost, s.void_reason, s.voided_by, s.id
from public.sale_items si join public.sales s on s.id = si.sale_id
where s.status = 'void'
order by si.id;

insert into public.stock_movement_log (kind, at, product_id, qty_change, unit_cost, note, user_id, adjustment_id)
select 'adjust_' || sa.reason::text, sa.created_at, sa.product_id, -sa.qty, sa.unit_cost, sa.note, sa.created_by, sa.id
from public.stock_adjustments sa
order by sa.id;

-- กราฟรายวันในหน้าประวัติ stock อ่านจากตารางใหม่
create or replace function public.daily_stock_movements(p_from date, p_to date)
returns table (day date, purchase_qty integer, sale_qty integer, adjust_qty integer, void_qty integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_to - p_from > 366 then
    raise exception 'ช่วงวันที่ยาวเกินไป';
  end if;

  return query
    with m as (
      select (sm.at at time zone 'Asia/Bangkok')::date as d, sm.category, abs(sm.qty_change) as qty
      from stock_movement_log sm
      where sm.at >= (p_from::timestamp at time zone 'Asia/Bangkok')
        and sm.at < ((p_to + 1)::timestamp at time zone 'Asia/Bangkok')
    )
    select g.d::date,
           coalesce(sum(m.qty) filter (where m.category = 'purchase'), 0)::integer,
           coalesce(sum(m.qty) filter (where m.category = 'sale'), 0)::integer,
           coalesce(sum(m.qty) filter (where m.category = 'adjust'), 0)::integer,
           coalesce(sum(m.qty) filter (where m.category = 'void'), 0)::integer
    from generate_series(p_from, p_to, interval '1 day') g(d)
    left join m on m.d = g.d::date
    group by g.d
    order by 1;
end $$;

-- ---------------------------------------------------------------------------
-- 2) sales_summary: จำกัดช่วงไม่เกิน 1 ปี (ส่วนที่เหลือเหมือนเดิม)
-- ---------------------------------------------------------------------------
create or replace function public.sales_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform require_admin();

  -- หน้าเว็บเลือกได้ถึง 366 วัน และเวลาจบนับถึงต้นวันถัดไป จึงเผื่อเป็น 367 วัน
  if p_to - p_from > interval '367 days' then
    raise exception 'เลือกช่วงวันที่ได้ไม่เกิน 1 ปี';
  end if;

  with s as (
    select * from sales where status = 'completed' and sold_at >= p_from and sold_at < p_to
  ),
  items as (
    select si.*, s.price_type from sale_items si join s on s.id = si.sale_id
  ),
  adj as (
    select * from stock_adjustments where created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'bill_count', (select count(*) from s),
    'total_qty', coalesce((select sum(total_qty) from s), 0),
    'revenue', coalesce((select sum(total_amount) from s), 0),
    'cost', coalesce((select round(sum(qty * unit_cost), 2) from items), 0),
    'cash_amount', coalesce((select sum(total_amount) from s where payment_method = 'cash'), 0),
    'promptpay_amount', coalesce((select sum(total_amount) from s where payment_method = 'promptpay'), 0),
    'retail_amount', coalesce((select sum(total_amount) from s where price_type = 'retail'), 0),
    'wholesale_amount', coalesce((select sum(total_amount) from s where price_type = 'wholesale'), 0),
    'void_count', (select count(*) from sales where status = 'void' and sold_at >= p_from and sold_at < p_to),
    'by_product', coalesce((
      select jsonb_agg(row_to_json(x) order by x.sort_order, x.product_id)
      from (
        select i.product_id, p.name, p.kind, p.sort_order,
               sum(i.qty) as qty,
               sum(i.qty * i.unit_price) as revenue,
               round(sum(i.qty * i.unit_cost), 2) as cost
        from items i join products p on p.id = i.product_id
        group by i.product_id, p.name, p.kind, p.sort_order
      ) x
    ), '[]'::jsonb),
    'losses', coalesce((
      select jsonb_agg(row_to_json(x))
      from (
        select reason, sum(qty) as qty, round(sum(qty * unit_cost), 2) as cost
        from adj group by reason
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- 3) ยอดสรุปแบบเบาของหน้าประวัติการขาย ไม่ต้องคำนวณต้นทุนและยอดรายสินค้า
-- ---------------------------------------------------------------------------
create function public.sales_page_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform require_admin();

  if p_to - p_from > interval '367 days' then
    raise exception 'เลือกช่วงวันที่ได้ไม่เกิน 1 ปี';
  end if;

  select jsonb_build_object(
    'bill_count', count(*) filter (where status = 'completed'),
    'total_qty', coalesce(sum(total_qty) filter (where status = 'completed'), 0),
    'revenue', coalesce(sum(total_amount) filter (where status = 'completed'), 0),
    'void_count', count(*) filter (where status = 'void')
  ) into v_result
  from sales
  where sold_at >= p_from and sold_at < p_to;

  return v_result;
end $$;

revoke execute on function public.sales_page_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.sales_page_summary(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) รอบการซื้อของร้าน แบ่งหน้าตามรอบ รอบเดียวกันจึงไม่ถูกตัดข้ามหน้า
--    (1 รอบ = บรรทัดที่ created_at เดียวกัน, p_supplier = null คือไม่ระบุร้าน)
-- ---------------------------------------------------------------------------
create function public.supplier_rounds(p_supplier text, p_limit integer, p_offset integer)
returns table (product_id bigint, unit_cost numeric, qty integer, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'ค่าการแบ่งหน้าไม่ถูกต้อง';
  end if;

  return query
    with rounds as (
      select distinct sp.created_at as round_at
      from stock_purchases sp
      where (p_supplier is null and sp.supplier is null) or sp.supplier = p_supplier
      order by round_at desc
      limit p_limit offset p_offset
    )
    select sp.product_id, sp.unit_cost, sp.qty, sp.note, sp.created_at
    from stock_purchases sp
    join rounds r on r.round_at = sp.created_at
    where (p_supplier is null and sp.supplier is null) or sp.supplier = p_supplier
    order by sp.created_at desc, sp.id;
end $$;

revoke execute on function public.supplier_rounds(text, integer, integer) from public, anon;
grant execute on function public.supplier_rounds(text, integer, integer) to authenticated;
