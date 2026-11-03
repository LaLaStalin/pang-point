-- แอดมินแก้ประเภทของรายการตัด stock ย้อนหลังได้ (เช่น เลือก "เสียหาย" แต่จริง ๆ คือ "ชิม/กิน")
-- แก้ได้เฉพาะประเภท จำนวน stock และต้นทุนที่บันทึกไว้ไม่เปลี่ยน
create or replace function public.update_adjustment_reason(
  p_adjustment_id bigint,
  p_reason public.adjust_reason
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_reason is null then
    raise exception 'กรุณาเลือกประเภท';
  end if;

  update stock_adjustments set reason = p_reason where id = p_adjustment_id;
  if not found then
    raise exception 'ไม่พบรายการ';
  end if;
end $$;

revoke execute on function public.update_adjustment_reason(bigint, public.adjust_reason) from public, anon;
grant execute on function public.update_adjustment_reason(bigint, public.adjust_reason) to authenticated;

-- เพิ่มคอลัมน์ adjustment_id ท้าย view ประวัติ stock ให้หน้าประวัติอ้างถึงรายการที่จะแก้ได้
create or replace view public.stock_movements with (security_invoker = true) as
  select 'purchase'::text as kind, sp.created_at as at, sp.product_id, sp.qty as qty_change,
         sp.unit_cost, sp.note, sp.created_by as user_id, null::bigint as sale_id, sp.supplier,
         null::bigint as adjustment_id
  from public.stock_purchases sp
  union all
  select 'sale', s.sold_at, si.product_id, -si.qty, si.unit_cost, null, s.sold_by, s.id, null, null
  from public.sale_items si join public.sales s on s.id = si.sale_id
  union all
  select 'void', s.voided_at, si.product_id, si.qty, si.unit_cost, s.void_reason, s.voided_by, s.id, null, null
  from public.sale_items si join public.sales s on s.id = si.sale_id
  where s.status = 'void'
  union all
  select 'adjust_' || sa.reason::text, sa.created_at, sa.product_id, -sa.qty, sa.unit_cost, sa.note, sa.created_by, null, null, sa.id
  from public.stock_adjustments sa;
