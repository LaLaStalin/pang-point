-- หน้าร้านตัด stock เองไม่ได้แล้ว: ส่งเป็นคำขอให้แอดมินอนุมัติก่อน stock จึงจะลด
-- แอดมินยังตัดได้ทันทีผ่าน adjust_stock (กลับมาเป็นเฉพาะแอดมิน แทนที่ 20261103000000)
create type public.adjust_request_status as enum ('pending', 'approved', 'rejected');

create table public.stock_adjustment_requests (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id),
  qty integer not null check (qty > 0),
  reason public.adjust_reason not null,
  note text not null check (length(btrim(note)) > 0),
  status public.adjust_request_status not null default 'pending',
  requested_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  adjustment_id bigint references public.stock_adjustments (id)  -- รายการตัดจริง เมื่ออนุมัติแล้ว
);
create index stock_adjustment_requests_pending_idx on public.stock_adjustment_requests (created_at)
  where status = 'pending';

-- หน้าร้านอ่านไม่ได้ (ไม่มีตารางให้ดู) และเขียนตรงไม่ได้ ต้องผ่านฟังก์ชันเท่านั้น
alter table public.stock_adjustment_requests enable row level security;
create policy "stock_adjustment_requests: admin read" on public.stock_adjustment_requests
  for select to authenticated using ((select public.is_admin()));

-- ตัด stock จริง เก็บต้นทุน ณ ตอนนี้ (ใช้ร่วมกันทั้งแอดมินตัดเองและตอนอนุมัติคำขอ)
create or replace function public._apply_stock_adjustment(
  p_product_id bigint,
  p_qty integer,
  p_reason public.adjust_reason,
  p_note text,
  p_created_by uuid
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_cost numeric;
  v_id bigint;
begin
  perform 1 from products where id = p_product_id for update;
  select avg_cost into v_cost from product_costs where product_id = p_product_id;
  if not found then
    raise exception 'ไม่พบสินค้า';
  end if;

  update products set qty_on_hand = qty_on_hand - p_qty where id = p_product_id;

  insert into stock_adjustments (product_id, qty, reason, note, unit_cost, created_by)
  values (p_product_id, p_qty, p_reason, btrim(p_note), v_cost, p_created_by)
  returning id into v_id;
  return v_id;
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
begin
  perform require_admin();

  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'กรุณาระบุหมายเหตุ';
  end if;

  perform _apply_stock_adjustment(p_product_id, p_qty, p_reason, p_note, auth.uid());
end $$;

-- หน้าร้านส่งคำขอ: ยังไม่แตะ stock
create or replace function public.request_stock_adjustment(
  p_product_id bigint,
  p_qty integer,
  p_reason public.adjust_reason,
  p_note text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'กรุณาเข้าสู่ระบบ' using errcode = '42501';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'กรุณาระบุหมายเหตุ';
  end if;
  if not exists (select 1 from products where id = p_product_id) then
    raise exception 'ไม่พบสินค้า';
  end if;

  insert into stock_adjustment_requests (product_id, qty, reason, note, requested_by)
  values (p_product_id, p_qty, p_reason, btrim(p_note), auth.uid());
end $$;

-- แอดมินอนุมัติ: ตัด stock ตอนนี้ โดยบันทึกว่าคนขอเป็นผู้ตัด (คนอนุมัติอยู่ที่ reviewed_by)
create or replace function public.approve_stock_adjustment_request(p_request_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_req stock_adjustment_requests%rowtype;
  v_adjustment_id bigint;
begin
  perform require_admin();

  -- ล็อกแถวไว้ กันอนุมัติซ้ำแล้ว stock ถูกตัดสองรอบ
  select * into v_req from stock_adjustment_requests where id = p_request_id for update;
  if not found then
    raise exception 'ไม่พบคำขอ';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'คำขอนี้ถูกจัดการไปแล้ว';
  end if;

  v_adjustment_id := _apply_stock_adjustment(v_req.product_id, v_req.qty, v_req.reason, v_req.note, v_req.requested_by);

  update stock_adjustment_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), adjustment_id = v_adjustment_id
  where id = p_request_id;
end $$;

create or replace function public.reject_stock_adjustment_request(p_request_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status public.adjust_request_status;
begin
  perform require_admin();

  select status into v_status from stock_adjustment_requests where id = p_request_id for update;
  if not found then
    raise exception 'ไม่พบคำขอ';
  end if;
  if v_status <> 'pending' then
    raise exception 'คำขอนี้ถูกจัดการไปแล้ว';
  end if;

  update stock_adjustment_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;
end $$;

revoke execute on function public._apply_stock_adjustment(bigint, integer, public.adjust_reason, text, uuid) from public, anon, authenticated;
revoke execute on function public.request_stock_adjustment(bigint, integer, public.adjust_reason, text) from public, anon;
revoke execute on function public.approve_stock_adjustment_request(bigint) from public, anon;
revoke execute on function public.reject_stock_adjustment_request(bigint) from public, anon;
grant execute on function public.request_stock_adjustment(bigint, integer, public.adjust_reason, text) to authenticated;
grant execute on function public.approve_stock_adjustment_request(bigint) to authenticated;
grant execute on function public.reject_stock_adjustment_request(bigint) to authenticated;
