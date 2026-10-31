-- เก็บชื่อร้านที่ซื้อของเข้า ไว้ดูย้อนหลังว่าแต่ละร้านเคยสั่งอะไร ราคาเท่าไหร่
-- รันต่อจาก 20261030010000_two_accounts_cost_split.sql (ไม่ต้องรันไฟล์ก่อนหน้าซ้ำ)

alter table public.stock_purchases add column supplier text;
create index stock_purchases_supplier_idx on public.stock_purchases (supplier, created_at desc);

-- เปลี่ยน add_stock ให้รับชื่อร้าน (บังคับใส่) — ลบตัวเก่าก่อน เพราะพารามิเตอร์เปลี่ยน
drop function public.add_stock(jsonb, text);

create function public.add_stock(p_lines jsonb, p_supplier text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_line record;
  v_supplier text := btrim(regexp_replace(coalesce(p_supplier, ''), '\s+', ' ', 'g'));
begin
  perform require_admin();

  if v_supplier = '' then
    raise exception 'กรุณาใส่ชื่อร้านที่ซื้อ';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'ไม่มีรายการที่จะเพิ่ม';
  end if;

  for v_line in
    select (e ->> 'product_id')::bigint as product_id,
           (e ->> 'unit_cost')::numeric as unit_cost,
           (e ->> 'qty')::integer as qty
    from jsonb_array_elements(p_lines) e
    order by 1
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'จำนวนต้องมากกว่า 0';
    end if;
    if v_line.unit_cost is null or v_line.unit_cost < 0 then
      raise exception 'ต้นทุนต้องไม่ติดลบ';
    end if;

    perform _receive_stock(v_line.product_id, v_line.qty, v_line.unit_cost);

    -- ทุกบรรทัดในครั้งเดียวกันได้ created_at เดียวกัน (now() คงที่ในทรานแซกชัน) ใช้จัดกลุ่มเป็น 1 รอบการซื้อ
    insert into stock_purchases (product_id, unit_cost, qty, supplier, note, created_by)
    values (v_line.product_id, v_line.unit_cost, v_line.qty, v_supplier, nullif(btrim(p_note), ''), auth.uid());
  end loop;
end $$;

revoke execute on function public.add_stock(jsonb, text, text) from public, anon;
grant execute on function public.add_stock(jsonb, text, text) to authenticated;

-- เพิ่มคอลัมน์ supplier ท้าย view ประวัติ stock (create or replace เพิ่มคอลัมน์ได้แค่ท้ายสุด)
create or replace view public.stock_movements with (security_invoker = true) as
  select 'purchase'::text as kind, sp.created_at as at, sp.product_id, sp.qty as qty_change,
         sp.unit_cost, sp.note, sp.created_by as user_id, null::bigint as sale_id, sp.supplier
  from public.stock_purchases sp
  union all
  select 'sale', s.sold_at, si.product_id, -si.qty, si.unit_cost, null, s.sold_by, s.id, null
  from public.sale_items si join public.sales s on s.id = si.sale_id
  union all
  select 'void', s.voided_at, si.product_id, si.qty, si.unit_cost, s.void_reason, s.voided_by, s.id, null
  from public.sale_items si join public.sales s on s.id = si.sale_id
  where s.status = 'void'
  union all
  select 'adjust_' || sa.reason::text, sa.created_at, sa.product_id, -sa.qty, sa.unit_cost, sa.note, sa.created_by, null, null
  from public.stock_adjustments sa;
