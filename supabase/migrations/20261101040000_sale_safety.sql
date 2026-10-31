-- ความปลอดภัยของการขาย / รหัสผ่าน
-- 1) รหัสแอดมินต้องยาวอย่างน้อย 8 หลัก (หน้าร้านยัง 6 หลัก) — เดารหัสยากขึ้น
-- 2) create_sale รับยอดที่หน้าจอแสดงลูกค้า ถ้าไม่ตรงกับราคาในฐานข้อมูล (แอดมินเพิ่งแก้ราคา) ปฏิเสธบิล
-- 3) create_sale รับรหัสบิลจากหน้าจอ (client_ref) ส่งซ้ำตอนเน็ตหลุดจะไม่เกิดบิลซ้ำ
-- 4) void_sale ไม่ให้บรรทัดที่ต้นทุน 0 (ขายก่อนบันทึกของเข้า) ไปดึงต้นทุนเฉลี่ยให้ต่ำลง

-- ---------------------------------------------------------------------------
-- 1) admin_set_password
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_password(p_account text, p_password text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_min integer;
begin
  perform require_admin();

  if p_account not in ('admin', 'shop') then
    raise exception 'ไม่รู้จักบัญชี %', p_account;
  end if;
  v_min := case when p_account = 'admin' then 8 else 6 end;
  if p_password is null or p_password !~ ('^[0-9]{' || v_min || ',}$') then
    raise exception 'รหัสผ่านต้องเป็นตัวเลขอย่างน้อย % หลัก', v_min;
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where email = p_account || '@pangpoint.local';

  if not found then
    raise exception 'ไม่พบบัญชี %@pangpoint.local', p_account;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) + 3) create_sale
-- ---------------------------------------------------------------------------
alter table public.sales add column client_ref uuid unique;

-- เปลี่ยนพารามิเตอร์ ต้องลบตัวเดิมก่อน (create or replace จะกลายเป็นฟังก์ชันใหม่อีกตัว)
drop function public.create_sale(public.price_type, public.payment_method, numeric, jsonb);

create function public.create_sale(
  p_price_type public.price_type,
  p_payment_method public.payment_method,
  p_received numeric,
  p_items jsonb,
  p_expected_total numeric default null,  -- ยอดที่หน้าจอแสดงลูกค้า
  p_client_ref uuid default null          -- รหัสบิลจากหน้าจอ ส่งซ้ำได้ไม่เกิดบิลซ้ำ
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sale sales%rowtype;
  v_total numeric(10, 2);
  v_qty integer;
  v_lines integer;
  v_found integer;
  v_received numeric(10, 2);
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'กรุณาเข้าสู่ระบบ' using errcode = '42501';
  end if;

  -- บิลนี้เคยบันทึกสำเร็จแล้ว (เน็ตหลุดตอนรอผล แล้วกดยืนยันซ้ำ) -> ส่งบิลเดิมกลับ
  if p_client_ref is not null then
    perform pg_advisory_xact_lock(hashtext(p_client_ref::text));
    select * into v_sale from sales where client_ref = p_client_ref;
    if found then
      return jsonb_build_object(
        'id', v_sale.id,
        'sold_at', v_sale.sold_at,
        'total_qty', v_sale.total_qty,
        'total_amount', v_sale.total_amount,
        'received_amount', v_sale.received_amount,
        'change_amount', v_sale.change_amount,
        'payment_method', v_sale.payment_method,
        'duplicate', true
      );
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'ยังไม่ได้เลือกสินค้า';
  end if;

  -- รวมบรรทัดสินค้าเดียวกัน
  create temp table _cart on commit drop as
    select (e ->> 'product_id')::bigint as product_id, sum((e ->> 'qty')::integer)::integer as qty
    from jsonb_array_elements(p_items) e
    group by 1;

  if exists (select 1 from _cart where qty is null or qty <= 0) then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;

  -- ล็อกตามลำดับ id กัน deadlock เมื่อขายพร้อมกันหลายเครื่อง
  perform 1 from products
  where id in (select product_id from _cart)
  order by id
  for update;

  select count(*), count(p.id),
         sum(c.qty),
         sum(c.qty * case when p_price_type = 'retail' then p.retail_price else p.wholesale_price end)
    into v_lines, v_found, v_qty, v_total
  from _cart c
  left join products p on p.id = c.product_id and p.is_active;

  if v_found <> v_lines then
    raise exception 'มีสินค้าที่ไม่พบหรือถูกปิดใช้งาน กรุณาโหลดหน้าใหม่';
  end if;

  if p_expected_total is not null and p_expected_total <> v_total then
    raise exception 'ราคามีการเปลี่ยนแปลง ยอดที่ถูกต้องคือ % บาท กรุณาโหลดราคาใหม่', v_total
      using hint = 'price_changed';
  end if;

  if p_payment_method = 'promptpay' then
    v_received := v_total;
  else
    v_received := p_received;
    if v_received is null or v_received < v_total then
      raise exception 'รับเงินมาไม่พอ (ยอด % บาท)', v_total;
    end if;
  end if;

  insert into sales (price_type, payment_method, total_qty, total_amount, received_amount, change_amount, sold_by, client_ref)
  values (p_price_type, p_payment_method, v_qty, v_total, v_received, v_received - v_total, auth.uid(), p_client_ref)
  returning * into v_sale;

  insert into sale_items (sale_id, product_id, unit_price, qty, unit_cost)
  select v_sale.id, p.id,
         case when p_price_type = 'retail' then p.retail_price else p.wholesale_price end,
         c.qty, coalesce(pc.avg_cost, 0)
  from _cart c
  join products p on p.id = c.product_id
  left join product_costs pc on pc.product_id = p.id;

  update products p set qty_on_hand = p.qty_on_hand - c.qty
  from _cart c
  where p.id = c.product_id;

  return jsonb_build_object(
    'id', v_sale.id,
    'sold_at', v_sale.sold_at,
    'total_qty', v_sale.total_qty,
    'total_amount', v_sale.total_amount,
    'received_amount', v_sale.received_amount,
    'change_amount', v_sale.change_amount,
    'payment_method', v_sale.payment_method,
    'duplicate', false
  );
end $$;

revoke execute on function public.create_sale(public.price_type, public.payment_method, numeric, jsonb, numeric, uuid) from public, anon;
grant execute on function public.create_sale(public.price_type, public.payment_method, numeric, jsonb, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) void_sale
-- ---------------------------------------------------------------------------
create or replace function public.void_sale(p_sale_id bigint, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status public.sale_status;
  v_item record;
begin
  perform require_admin();

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'กรุณาระบุเหตุผลที่ยกเลิก';
  end if;

  select status into v_status from sales where id = p_sale_id for update;
  if not found then
    raise exception 'ไม่พบบิล';
  end if;
  if v_status = 'void' then
    raise exception 'บิลนี้ถูกยกเลิกไปแล้ว';
  end if;

  for v_item in
    select product_id, qty, unit_cost from sale_items where sale_id = p_sale_id order by product_id
  loop
    if v_item.unit_cost > 0 then
      -- คืนของด้วยต้นทุนของบิลนั้น (คิดต้นทุนเฉลี่ยใหม่)
      perform _receive_stock(v_item.product_id, v_item.qty, v_item.unit_cost);
    else
      -- ต้นทุน 0 = ขายก่อนเคยบันทึกของเข้า ไม่รู้ต้นทุนจริง คืนแค่จำนวน ไม่แตะต้นทุนเฉลี่ย
      update products set qty_on_hand = qty_on_hand + v_item.qty where id = v_item.product_id;
    end if;
  end loop;

  update sales set
    status = 'void',
    voided_by = auth.uid(),
    voided_at = now(),
    void_reason = btrim(p_reason)
  where id = p_sale_id;
end $$;
