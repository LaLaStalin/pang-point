-- รายชื่อร้านที่ซื้อของ ให้เลือกตอนเพิ่ม stock และจัดการได้ที่หน้า ตั้งค่า
-- รันต่อจาก 20261030020000_purchase_supplier.sql (ไม่ต้องรันไฟล์ก่อนหน้าซ้ำ)
--
-- stock_purchases.supplier ยังเก็บเป็นชื่อ (ข้อความ) เหมือนเดิม ตารางนี้เป็นแค่รายการให้เลือก
-- ตอนเปลี่ยนชื่อร้านจึงต้องแก้ชื่อในประวัติการซื้อไปด้วย (ใช้ฟังก์ชัน rename_supplier)

create table public.suppliers (
  id bigint generated always as identity primary key,
  name text not null unique check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ร้านที่เคยกรอกไว้ก่อนมีตารางนี้
insert into public.suppliers (name)
select distinct supplier from public.stock_purchases where supplier is not null
on conflict (name) do nothing;

alter table public.suppliers enable row level security;
create policy "suppliers: admin read" on public.suppliers for select to authenticated using (public.is_admin());
create policy "suppliers: admin insert" on public.suppliers for insert to authenticated with check (public.is_admin());
create policy "suppliers: admin update" on public.suppliers for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ตัดช่องว่างหัวท้าย และช่องว่างซ้อนให้เหลือช่องเดียว ("ร้าน   จิน " -> "ร้าน จิน")
create or replace function public._clean_name(p text)
returns text
language sql immutable
as $$ select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) $$;

-- add_stock เดิม + บันทึกชื่อร้านใหม่เข้ารายการให้อัตโนมัติ (ถ้าร้านถูกซ่อนไว้จะกลับมาแสดง)
create or replace function public.add_stock(p_lines jsonb, p_supplier text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_line record;
  v_supplier text := _clean_name(p_supplier);
begin
  perform require_admin();

  if v_supplier = '' then
    raise exception 'กรุณาใส่ชื่อร้านที่ซื้อ';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'ไม่มีรายการที่จะเพิ่ม';
  end if;

  insert into suppliers (name) values (v_supplier)
  on conflict (name) do update set is_active = true;

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

-- เปลี่ยนชื่อร้าน พร้อมแก้ชื่อในประวัติการซื้อ
-- ถ้าชื่อใหม่ซ้ำกับร้านที่มีอยู่แล้ว จะรวมเป็นร้านเดียวกัน (ไว้แก้กรณีพิมพ์ชื่อผิดจนแยกเป็น 2 ร้าน)
create or replace function public.rename_supplier(p_id bigint, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_old text;
  v_new text := _clean_name(p_name);
begin
  perform require_admin();

  if v_new = '' then
    raise exception 'กรุณาใส่ชื่อร้าน';
  end if;

  select name into v_old from suppliers where id = p_id for update;
  if not found then
    raise exception 'ไม่พบร้านนี้';
  end if;
  if v_old = v_new then
    return;
  end if;

  update stock_purchases set supplier = v_new where supplier = v_old;

  if exists (select 1 from suppliers where name = v_new) then
    update suppliers set is_active = true where name = v_new;
    delete from suppliers where id = p_id;
  else
    update suppliers set name = v_new where id = p_id;
  end if;
end $$;

revoke execute on function public._clean_name(text) from public, anon;
revoke execute on function public.rename_supplier(bigint, text) from public, anon;
grant execute on function public.rename_supplier(bigint, text) to authenticated;
