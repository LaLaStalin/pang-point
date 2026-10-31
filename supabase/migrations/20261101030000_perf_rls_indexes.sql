-- ปรับความเร็วเมื่อข้อมูลเยอะ (สิทธิ์การเข้าถึงเหมือนเดิมทุกอย่าง)

-- ---------------------------------------------------------------------------
-- 1) RLS: ห่อ is_admin() / auth.uid() ด้วย (select ...) ให้ Postgres คำนวณครั้งเดียวต่อ query
--    แทนการเรียกซ้ำทุกแถว (คำแนะนำของ Supabase) — เงื่อนไขเหมือนเดิม
-- ---------------------------------------------------------------------------
alter policy "profiles: read self or admin" on public.profiles
  using (id = (select auth.uid()) or (select public.is_admin()));
alter policy "profiles: admin update" on public.profiles
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter policy "products: admin insert" on public.products
  with check ((select public.is_admin()));
alter policy "products: admin update" on public.products
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter policy "product_costs: admin read" on public.product_costs
  using ((select public.is_admin()));
alter policy "stock_purchases: admin read" on public.stock_purchases
  using ((select public.is_admin()));
alter policy "stock_adjustments: admin read" on public.stock_adjustments
  using ((select public.is_admin()));
alter policy "sales: admin read" on public.sales
  using ((select public.is_admin()));
alter policy "sale_items: admin read" on public.sale_items
  using ((select public.is_admin()));

alter policy "settings: admin update" on public.settings
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter policy "suppliers: admin read" on public.suppliers
  using ((select public.is_admin()));
alter policy "suppliers: admin insert" on public.suppliers
  with check ((select public.is_admin()));
alter policy "suppliers: admin update" on public.suppliers
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 2) ประวัติ stock ส่วน "ยกเลิกบิล" กรองด้วย voided_at — เดิมไม่มี index ต้องไล่ทุกบิล
-- ---------------------------------------------------------------------------
create index if not exists sales_voided_at_idx on public.sales (voided_at desc) where status = 'void';

-- ---------------------------------------------------------------------------
-- 3) รายชื่อร้านสำหรับหน้า "เพิ่ม stock": ร้านที่ซื้อล่าสุดขึ้นก่อน ที่เหลือเรียงตามชื่อ
--    (เดิมดึงประวัติซื้อ 1,000 บรรทัดมาหาเองในหน้าเว็บ)
-- ---------------------------------------------------------------------------
create or replace function public.active_suppliers_recent()
returns table (name text, last_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform require_admin();

  return query
    select s.name,
           (select max(sp.created_at) from stock_purchases sp where sp.supplier = s.name)
    from suppliers s
    where s.is_active
    order by 2 desc nulls last, s.name;
end $$;

revoke execute on function public.active_suppliers_recent() from public, anon;
grant execute on function public.active_suppliers_recent() to authenticated;
