-- สรุปหน้า "ร้านที่ซื้อ" ในฐานข้อมูล แทนการดึงประวัติทั้งหมดมารวมในหน้าเว็บ (ข้อมูลเยอะแล้วยอดไม่ขาด)

-- สรุปรายร้าน: ซื้อกี่รอบ (1 รอบ = บรรทัดที่บันทึกพร้อมกัน created_at เดียวกัน) / รวมชิ้น / รวมเงิน / ซื้อล่าสุด
-- supplier = null คือรายการที่ไม่ได้ระบุร้าน (ข้อมูลก่อนบังคับใส่ชื่อร้าน)
create or replace function public.supplier_summary()
returns table (supplier text, rounds bigint, qty bigint, cost numeric, last_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  return query
    select sp.supplier,
           count(distinct sp.created_at),
           sum(sp.qty)::bigint,
           sum(sp.qty * sp.unit_cost),
           max(sp.created_at)
    from stock_purchases sp
    group by sp.supplier
    order by max(sp.created_at) desc;
end $$;

-- สรุปรายชนิดของร้านที่เลือก: รวมกี่ชิ้น ทุนต่ำสุด/สูงสุด รวมเงิน (p_supplier = null คือไม่ระบุร้าน)
create or replace function public.supplier_product_summary(p_supplier text)
returns table (product_id bigint, qty bigint, cost numeric, min_cost numeric, max_cost numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  return query
    select sp.product_id,
           sum(sp.qty)::bigint,
           sum(sp.qty * sp.unit_cost),
           min(sp.unit_cost),
           max(sp.unit_cost)
    from stock_purchases sp
    where (p_supplier is null and sp.supplier is null) or sp.supplier = p_supplier
    group by sp.product_id
    order by sp.product_id;
end $$;

revoke execute on function public.supplier_summary() from public, anon;
revoke execute on function public.supplier_product_summary(text) from public, anon;
grant execute on function public.supplier_summary() to authenticated;
grant execute on function public.supplier_product_summary(text) to authenticated;
