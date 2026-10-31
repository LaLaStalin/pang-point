-- 1) แยกต้นทุนเฉลี่ยออกจาก products ไปไว้ใน product_costs ที่เฉพาะ admin อ่านได้
--    (บัญชีหน้าร้านยังอ่าน products ได้ตามปกติ แต่จะไม่เห็นต้นทุน)
-- 2) ใช้ 2 บัญชี: admin@pangpoint.local (แม่/ครอบครัว) และ shop@pangpoint.local (หน้าร้าน)
--    admin เปลี่ยนรหัสผ่านของทั้งสองบัญชีได้จากในเว็บ ผ่าน admin_set_password

-- ---------------------------------------------------------------------------
-- product_costs
-- ---------------------------------------------------------------------------
create table public.product_costs (
  product_id bigint primary key references public.products (id) on delete cascade,
  avg_cost numeric(12, 4) not null default 0
);

insert into public.product_costs (product_id, avg_cost)
select id, avg_cost from public.products;

alter table public.products drop column avg_cost;

alter table public.product_costs enable row level security;
create policy "product_costs: admin read" on public.product_costs
  for select to authenticated using (public.is_admin());

-- สินค้าใหม่ได้แถวต้นทุนอัตโนมัติ
create or replace function public.handle_new_product()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into product_costs (product_id) values (new.id);
  return new;
end $$;

create trigger on_product_created
  after insert on public.products
  for each row execute function public.handle_new_product();

-- สินค้า + ต้นทุน สำหรับหน้า admin (บัญชีหน้าร้านจะเห็น avg_cost เป็น null เพราะ RLS ของ product_costs)
create view public.products_admin with (security_invoker = true) as
  select p.*, c.avg_cost
  from public.products p
  left join public.product_costs c on c.product_id = p.id;

-- ---------------------------------------------------------------------------
-- ฟังก์ชัน stock / ขาย ที่อ่านต้นทุนจาก product_costs
-- ---------------------------------------------------------------------------
create or replace function public._receive_stock(p_product_id bigint, p_qty integer, p_unit_cost numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_qty integer;
  v_cost numeric;
begin
  select p.qty_on_hand, c.avg_cost into v_qty, v_cost
  from products p
  join product_costs c on c.product_id = p.id
  where p.id = p_product_id
  for update of p, c;

  if not found then
    raise exception 'ไม่พบสินค้า %', p_product_id;
  end if;

  update product_costs set avg_cost = case
    when v_qty <= 0 then p_unit_cost   -- stock หมดหรือติดลบ (ขายก่อนบันทึกของเข้า) ใช้ต้นทุนใหม่เลย
    else round((v_qty * v_cost + p_qty * p_unit_cost) / (v_qty + p_qty), 4)
  end
  where product_id = p_product_id;

  update products set qty_on_hand = v_qty + p_qty where id = p_product_id;
end $$;

create or replace function public.adjust_stock(
  p_product_id bigint,
  p_qty integer,
  p_reason public.adjust_reason,
  p_note text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cost numeric;
begin
  perform require_admin();

  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'กรุณาระบุหมายเหตุ';
  end if;

  perform 1 from products where id = p_product_id for update;
  select avg_cost into v_cost from product_costs where product_id = p_product_id;
  if not found then
    raise exception 'ไม่พบสินค้า';
  end if;

  update products set qty_on_hand = qty_on_hand - p_qty where id = p_product_id;

  insert into stock_adjustments (product_id, qty, reason, note, unit_cost, created_by)
  values (p_product_id, p_qty, p_reason, btrim(p_note), v_cost, auth.uid());
end $$;

create or replace function public.create_sale(
  p_price_type public.price_type,
  p_payment_method public.payment_method,
  p_received numeric,
  p_items jsonb
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

  if p_payment_method = 'promptpay' then
    v_received := v_total;
  else
    v_received := p_received;
    if v_received is null or v_received < v_total then
      raise exception 'รับเงินมาไม่พอ (ยอด % บาท)', v_total;
    end if;
  end if;

  insert into sales (price_type, payment_method, total_qty, total_amount, received_amount, change_amount, sold_by)
  values (p_price_type, p_payment_method, v_qty, v_total, v_received, v_received - v_total, auth.uid())
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
    'change_amount', v_sale.change_amount
  );
end $$;

-- ---------------------------------------------------------------------------
-- เปลี่ยนรหัสผ่านบัญชี admin / shop (เฉพาะ admin)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_password(p_account text, p_password text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform require_admin();

  if p_account not in ('admin', 'shop') then
    raise exception 'ไม่รู้จักบัญชี %', p_account;
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'รหัสผ่านอย่างน้อย 6 ตัว';
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
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_product() from public, anon, authenticated;
revoke execute on function public._receive_stock(bigint, integer, numeric) from public, anon, authenticated;
revoke execute on function public.adjust_stock(bigint, integer, public.adjust_reason, text) from public, anon;
revoke execute on function public.create_sale(public.price_type, public.payment_method, numeric, jsonb) from public, anon;
revoke execute on function public.admin_set_password(text, text) from public, anon;
grant execute on function public.adjust_stock(bigint, integer, public.adjust_reason, text) to authenticated;
grant execute on function public.create_sale(public.price_type, public.payment_method, numeric, jsonb) to authenticated;
grant execute on function public.admin_set_password(text, text) to authenticated;
