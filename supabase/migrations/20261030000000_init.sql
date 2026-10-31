-- ปังพอยต์ (เจ๊แหม่มสับปะรด) — schema เริ่มต้น
-- ต้นทุนใช้แบบ "เฉลี่ยถ่วงน้ำหนัก" ต่อสินค้า (products.avg_cost)
--   * เพิ่ม stock  -> คำนวณ avg_cost ใหม่
--   * ขาย / ตัดของเสีย / ชิม -> ใช้ avg_cost ณ ตอนนั้น (เก็บ snapshot) ไม่เปลี่ยนค่าเฉลี่ย
--   * ยกเลิกบิล -> คืนของเข้า stock ด้วยต้นทุน snapshot ของบิลนั้น

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'staff');
create type public.product_kind as enum ('tier', 'other');       -- tier = มีราคาปลีก/ส่ง, other = ราคาเต็มราคาเดียว (นับ stock รวมตามราคา)
create type public.price_type as enum ('retail', 'wholesale');
create type public.payment_method as enum ('cash', 'promptpay');
create type public.sale_status as enum ('completed', 'void');
create type public.adjust_reason as enum ('damaged', 'tasting', 'expired', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  kind public.product_kind not null,
  name text not null,
  retail_price numeric(10, 2) not null check (retail_price > 0),
  wholesale_price numeric(10, 2) not null check (wholesale_price > 0),
  qty_on_hand integer not null default 0,
  avg_cost numeric(12, 4) not null default 0,
  low_stock_threshold integer not null default 10,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint other_has_single_price check (kind = 'tier' or retail_price = wholesale_price)
);
create unique index products_other_price_uniq on public.products (retail_price)
  where kind = 'other' and is_active;

create table public.stock_purchases (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id),
  unit_cost numeric(10, 2) not null check (unit_cost >= 0),
  qty integer not null check (qty > 0),
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index stock_purchases_created_at_idx on public.stock_purchases (created_at desc);

create table public.stock_adjustments (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id),
  qty integer not null check (qty > 0),               -- จำนวนที่ตัดออก
  reason public.adjust_reason not null,
  note text not null check (length(btrim(note)) > 0), -- บังคับอธิบายหมายเหตุ
  unit_cost numeric(12, 4) not null,                  -- avg_cost ณ ตอนตัด ใช้คิดมูลค่าความเสียหาย
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index stock_adjustments_created_at_idx on public.stock_adjustments (created_at desc);

create table public.sales (
  id bigint generated always as identity primary key,
  price_type public.price_type not null,
  payment_method public.payment_method not null,
  total_qty integer not null,
  total_amount numeric(10, 2) not null,
  received_amount numeric(10, 2) not null,
  change_amount numeric(10, 2) not null,
  status public.sale_status not null default 'completed',
  sold_by uuid not null references public.profiles (id),
  sold_at timestamptz not null default now(),
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  void_reason text
);
create index sales_sold_at_idx on public.sales (sold_at desc);

create table public.sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint not null references public.sales (id) on delete cascade,
  product_id bigint not null references public.products (id),
  unit_price numeric(10, 2) not null,
  qty integer not null check (qty > 0),
  unit_cost numeric(12, 4) not null                   -- avg_cost ณ ตอนขาย
);
create index sale_items_sale_id_idx on public.sale_items (sale_id);

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  promptpay_id text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.require_admin()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
end $$;

-- สร้าง profile อัตโนมัติเมื่อมี user ใหม่ (role อ่านจาก app_metadata ซึ่งตั้งได้เฉพาะ service role)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'staff')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Stock functions
-- ---------------------------------------------------------------------------

-- รับของเข้า stock แล้วคำนวณต้นทุนเฉลี่ยถ่วงน้ำหนักใหม่ (ใช้ภายในเท่านั้น)
create or replace function public._receive_stock(p_product_id bigint, p_qty integer, p_unit_cost numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_qty integer;
  v_cost numeric;
begin
  select qty_on_hand, avg_cost into v_qty, v_cost
  from products where id = p_product_id
  for update;

  if not found then
    raise exception 'ไม่พบสินค้า %', p_product_id;
  end if;

  update products set
    avg_cost = case
      when v_qty <= 0 then p_unit_cost   -- stock หมดหรือติดลบ (ขายก่อนบันทึกของเข้า) ใช้ต้นทุนใหม่เลย
      else round((v_qty * v_cost + p_qty * p_unit_cost) / (v_qty + p_qty), 4)
    end,
    qty_on_hand = v_qty + p_qty
  where id = p_product_id;
end $$;

-- เพิ่ม stock หลายบรรทัดพร้อมกัน: p_lines = [{product_id, unit_cost, qty}, ...]
create or replace function public.add_stock(p_lines jsonb, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_line record;
begin
  perform require_admin();

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

    insert into stock_purchases (product_id, unit_cost, qty, note, created_by)
    values (v_line.product_id, v_line.unit_cost, v_line.qty, nullif(btrim(p_note), ''), auth.uid());
  end loop;
end $$;

-- ตัด stock เพราะเสียหาย / ชิม / หมดอายุ (ต้องมีหมายเหตุ)
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

  select avg_cost into v_cost from products where id = p_product_id for update;
  if not found then
    raise exception 'ไม่พบสินค้า';
  end if;

  update products set qty_on_hand = qty_on_hand - p_qty where id = p_product_id;

  insert into stock_adjustments (product_id, qty, reason, note, unit_cost, created_by)
  values (p_product_id, p_qty, p_reason, btrim(p_note), v_cost, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Sales functions
-- ---------------------------------------------------------------------------

-- บันทึกบิลขาย: p_items = [{product_id, qty}, ...]
-- ราคาอ่านจากฐานข้อมูล (ไม่เชื่อราคาจากหน้าเว็บ) และขายได้แม้ stock ในระบบไม่พอ (stock จะติดลบ)
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
         c.qty, p.avg_cost
  from _cart c
  join products p on p.id = c.product_id;

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

-- ยกเลิกบิล: คืนของเข้า stock ด้วยต้นทุนของบิลนั้น
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
    perform _receive_stock(v_item.product_id, v_item.qty, v_item.unit_cost);
  end loop;

  update sales set
    status = 'void',
    voided_by = auth.uid(),
    voided_at = now(),
    void_reason = btrim(p_reason)
  where id = p_sale_id;
end $$;

-- สรุปยอดขาย/กำไร/ของเสีย ในช่วงเวลา [p_from, p_to)
create or replace function public.sales_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform require_admin();

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
-- ประวัติการเคลื่อนไหว stock (เข้า / ขาย / ยกเลิกบิล / ตัดออก)
-- ---------------------------------------------------------------------------
create view public.stock_movements with (security_invoker = true) as
  select 'purchase'::text as kind, sp.created_at as at, sp.product_id, sp.qty as qty_change,
         sp.unit_cost, sp.note, sp.created_by as user_id, null::bigint as sale_id
  from public.stock_purchases sp
  union all
  select 'sale', s.sold_at, si.product_id, -si.qty, si.unit_cost, null, s.sold_by, s.id
  from public.sale_items si join public.sales s on s.id = si.sale_id
  union all
  select 'void', s.voided_at, si.product_id, si.qty, si.unit_cost, s.void_reason, s.voided_by, s.id
  from public.sale_items si join public.sales s on s.id = si.sale_id
  where s.status = 'void'
  union all
  select 'adjust_' || sa.reason::text, sa.created_at, sa.product_id, -sa.qty, sa.unit_cost, sa.note, sa.created_by, null
  from public.stock_adjustments sa;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_purchases enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.settings enable row level security;

create policy "profiles: read self or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: admin update" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products: read" on public.products
  for select to authenticated using (true);
create policy "products: admin insert" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "products: admin update" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- การเขียนข้อมูล stock และบิลทำผ่านฟังก์ชันด้านบนเท่านั้น
create policy "stock_purchases: admin read" on public.stock_purchases
  for select to authenticated using (public.is_admin());
create policy "stock_adjustments: admin read" on public.stock_adjustments
  for select to authenticated using (public.is_admin());
create policy "sales: admin read" on public.sales
  for select to authenticated using (public.is_admin());
create policy "sale_items: admin read" on public.sale_items
  for select to authenticated using (public.is_admin());

create policy "settings: read" on public.settings
  for select to authenticated using (true);
create policy "settings: admin update" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on function public._receive_stock(bigint, integer, numeric) from authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.add_stock(jsonb, text) to authenticated;
grant execute on function public.adjust_stock(bigint, integer, public.adjust_reason, text) to authenticated;
grant execute on function public.create_sale(public.price_type, public.payment_method, numeric, jsonb) to authenticated;
grant execute on function public.void_sale(bigint, text) to authenticated;
grant execute on function public.sales_summary(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- ข้อมูลเริ่มต้น (แก้ราคาได้ภายหลังที่หน้า ตั้งค่า)
-- ---------------------------------------------------------------------------
insert into public.settings (id) values (1);

insert into public.products (kind, name, retail_price, wholesale_price, sort_order) values
  ('tier', 'ขนมแห้ง', 15, 14, 1),
  ('tier', 'ขนมปัง', 20, 16, 2),
  ('other', 'อื่นๆ 20 บาท', 20, 20, 10),
  ('other', 'อื่นๆ 30 บาท', 30, 30, 11),
  ('other', 'อื่นๆ 45 บาท', 45, 45, 12),
  ('other', 'อื่นๆ 70 บาท', 70, 70, 13),
  ('other', 'อื่นๆ 80 บาท', 80, 80, 14);
