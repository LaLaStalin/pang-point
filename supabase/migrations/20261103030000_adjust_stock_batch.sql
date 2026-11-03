-- แอดมินตัด stock หลายรายการในครั้งเดียว: สำเร็จทั้งชุดหรือไม่ตัดเลย (อยู่ใน transaction เดียว)
-- p_lines = [{ "product_id": 1, "qty": 3, "reason": "expired" }, ...] ใช้หมายเหตุเดียวกันทุกรายการ
create or replace function public.adjust_stock_batch(p_lines jsonb, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_line record;
begin
  perform require_admin();

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'ยังไม่ได้เลือกสินค้า';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'กรุณาระบุหมายเหตุ';
  end if;

  -- ไล่ตามลำดับ id กัน deadlock เมื่อมีการขายหรือตัด stock พร้อมกัน
  for v_line in
    select (e ->> 'product_id')::bigint as product_id,
           (e ->> 'qty')::integer as qty,
           (e ->> 'reason')::public.adjust_reason as reason
    from jsonb_array_elements(p_lines) e
    order by 1
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'จำนวนต้องมากกว่า 0';
    end if;
    if v_line.reason is null then
      raise exception 'กรุณาเลือกเหตุผล';
    end if;

    perform _apply_stock_adjustment(v_line.product_id, v_line.qty, v_line.reason, p_note, auth.uid());
  end loop;
end $$;

revoke execute on function public.adjust_stock_batch(jsonb, text) from public, anon;
grant execute on function public.adjust_stock_batch(jsonb, text) to authenticated;
