-- ทดสอบ trigger ของ stock_movement_log บนฐานข้อมูลจริง: รันใน Supabase SQL Editor
-- ไม่บันทึกข้อมูล: จบสคริปต์ด้วย error เสมอ เพื่อให้ฐานข้อมูลยกเลิกทุกอย่างที่ทำในสคริปต์
-- ผลทดสอบจะแสดงในข้อความ error บรรทัด "ผลทดสอบ" ทุกข้อควรขึ้น PASS
-- ควรรันตอนไม่มีการขาย เพราะการเปลี่ยนชื่อร้านจะล็อกแถวไว้ชั่วครู่ระหว่างรัน
do $$
declare
  v_admin uuid;
  v_staff uuid;
  v_p1 bigint;
  v_p2 bigint;
  v_req1 bigint;
  v_req2 bigint;
  v_adj bigint;
  v_supplier_id bigint;
  v_supplier text;
  v_new_name text := 'ทดสอบเปลี่ยนชื่อร้าน-' || floor(random() * 1000000)::text;
  v_n bigint;
  v_kind text;
  v_only_view bigint;
  v_only_log bigint;
  v_qty_before integer;
  v_qty_after integer;
  v_out text := '';
  v_fail integer := 0;

  -- ใช้ซ้ำไม่ได้ใน do block จึงเก็บจำนวนแถวก่อนหน้าไว้เทียบแต่ละข้อ
  v_before bigint;
begin
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  select id into v_staff from public.profiles where role = 'staff' order by created_at limit 1;
  if v_admin is null or v_staff is null then
    raise exception 'ไม่พบบัญชีแอดมินหรือหน้าร้าน';
  end if;

  select id into v_p1 from public.products where is_active order by id limit 1;
  select id into v_p2 from public.products where is_active and id <> v_p1 order by id limit 1;
  if v_p2 is null then
    raise exception 'ต้องมีสินค้าที่เปิดขายอย่างน้อย 2 ชนิด';
  end if;

  -- 1) หน้าร้านส่งคำขอ 2 รายการ: stock และประวัติยังไม่เปลี่ยน
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  select count(*) into v_before from public.stock_movement_log;
  select qty_on_hand into v_qty_before from public.products where id = v_p1;
  perform public.request_stock_adjustment(v_p1, 1, 'damaged'::public.adjust_reason, 'ทดสอบคำขอ 1');
  select max(id) into v_req1 from public.stock_adjustment_requests;
  perform public.request_stock_adjustment(v_p1, 1, 'tasting'::public.adjust_reason, 'ทดสอบคำขอ 2');
  select max(id) into v_req2 from public.stock_adjustment_requests;
  select count(*) into v_n from public.stock_movement_log;
  if v_n = v_before then v_out := v_out || E'\nPASS 1 คำขอจากหน้าร้านยังไม่เพิ่มประวัติ';
  else v_fail := v_fail + 1; v_out := v_out || format(E'\nFAIL 1 คำขอจากหน้าร้าน: เพิ่ม %s แถว', v_n - v_before); end if;

  -- 2) แอดมินปฏิเสธ 1 อนุมัติ 1: ประวัติเพิ่ม 1 แถว stock ลด 1
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.reject_stock_adjustment_request(v_req2);
  select count(*) into v_n from public.stock_movement_log;
  if v_n = v_before then v_out := v_out || E'\nPASS 2 ปฏิเสธคำขอแล้วประวัติไม่เพิ่ม';
  else v_fail := v_fail + 1; v_out := v_out || format(E'\nFAIL 2 ปฏิเสธคำขอ: เพิ่ม %s แถว', v_n - v_before); end if;

  perform public.approve_stock_adjustment_request(v_req1);
  select count(*) into v_n from public.stock_movement_log;
  select qty_on_hand into v_qty_after from public.products where id = v_p1;
  if v_n = v_before + 1 and v_qty_after = v_qty_before - 1 then v_out := v_out || E'\nPASS 3 อนุมัติคำขอแล้วประวัติเพิ่ม 1 แถวและ stock ลด 1';
  else v_fail := v_fail + 1; v_out := v_out || format(E'\nFAIL 3 อนุมัติคำขอ: เพิ่ม %s แถว stock %s -> %s', v_n - v_before, v_qty_before, v_qty_after); end if;

  -- 3) แอดมินตัด 2 รายการพร้อมกัน
  select count(*) into v_before from public.stock_movement_log;
  perform public.adjust_stock_batch(
    jsonb_build_array(
      jsonb_build_object('product_id', v_p1, 'qty', 1, 'reason', 'expired'),
      jsonb_build_object('product_id', v_p2, 'qty', 1, 'reason', 'other')
    ),
    'ทดสอบตัดหลายรายการ'
  );
  select count(*) into v_n from public.stock_movement_log;
  if v_n = v_before + 2 then v_out := v_out || E'\nPASS 4 ตัดหลายรายการแล้วประวัติเพิ่มตามจำนวนรายการ';
  else v_fail := v_fail + 1; v_out := v_out || format(E'\nFAIL 4 ตัดหลายรายการ: เพิ่ม %s แถว', v_n - v_before); end if;

  -- 4) แก้เหตุผล: จำนวนแถวไม่เปลี่ยน แต่ประเภทเปลี่ยน
  select count(*) into v_before from public.stock_movement_log;
  select max(id) into v_adj from public.stock_adjustments;
  perform public.update_adjustment_reason(v_adj, 'tasting'::public.adjust_reason);
  select count(*) into v_n from public.stock_movement_log;
  select kind into v_kind from public.stock_movement_log where adjustment_id = v_adj;
  if v_n = v_before and v_kind = 'adjust_tasting' then v_out := v_out || E'\nPASS 5 แก้เหตุผลแล้วประเภทในประวัติเปลี่ยนตาม';
  else v_fail := v_fail + 1; v_out := v_out || format(E'\nFAIL 5 แก้เหตุผล: เพิ่ม %s แถว ประเภท %s', v_n - v_before, v_kind); end if;

  -- 5) เปลี่ยนชื่อร้าน: จำนวนแถวไม่เปลี่ยน แต่ชื่อในประวัติเปลี่ยน
  select s.id, s.name into v_supplier_id, v_supplier
  from public.suppliers s
  where exists (select 1 from public.stock_purchases sp where sp.supplier = s.name)
  order by s.id limit 1;
  if v_supplier_id is null then
    v_out := v_out || E'\nSKIP 6 ยังไม่มีร้านที่เคยรับของ';
  else
    select count(*) into v_before from public.stock_movement_log;
    perform public.rename_supplier(v_supplier_id, v_new_name);
    select count(*) into v_n from public.stock_movement_log;
    if v_n = v_before
       and not exists (select 1 from public.stock_movement_log where supplier = v_supplier)
       and exists (select 1 from public.stock_movement_log where supplier = v_new_name) then
      v_out := v_out || E'\nPASS 6 เปลี่ยนชื่อร้านแล้วชื่อในประวัติเปลี่ยนตาม';
    else
      v_fail := v_fail + 1;
      v_out := v_out || format(E'\nFAIL 6 เปลี่ยนชื่อร้าน: เพิ่ม %s แถว', v_n - v_before);
    end if;
  end if;

  -- 6) เทียบกับข้อมูลต้นทางทั้งหมด
  select count(*) into v_only_view from (
    select kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id, supplier, adjustment_id from public.stock_movements
    except all
    select kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id, supplier, adjustment_id from public.stock_movement_log
  ) x;
  select count(*) into v_only_log from (
    select kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id, supplier, adjustment_id from public.stock_movement_log
    except all
    select kind, at, product_id, qty_change, unit_cost, note, user_id, sale_id, supplier, adjustment_id from public.stock_movements
  ) x;
  if v_only_view = 0 and v_only_log = 0 then v_out := v_out || E'\nPASS 7 ประวัติตรงกับข้อมูลต้นทาง';
  else v_fail := v_fail + 1; v_out := v_out || format(E'\nFAIL 7 ไม่ตรงกับข้อมูลต้นทาง: only_in_view=%s only_in_log=%s', v_only_view, v_only_log); end if;

  -- จบด้วย error เสมอ เพื่อยกเลิกทุกอย่างที่ทำในสคริปต์
  raise exception E'ผลทดสอบ: ไม่ผ่าน % ข้อ (ยกเลิกข้อมูลทดสอบทั้งหมดแล้ว)%', v_fail, v_out;
end $$;
