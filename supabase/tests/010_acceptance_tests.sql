-- =====================================================================
-- Aunchan POS — 010_acceptance_tests.sql
-- เกณฑ์ตรวจรับตาม AUNCHAN-SPEC.md §10
-- รันใน Supabase SQL Editor หลังรัน 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 ครบแล้ว
-- ผลลัพธ์: ตารางสรุป ข้อ / สิ่งที่ทดสอบ / ค่าที่คาด / ค่าจริง / ผ่านหรือไม่
--
-- หมายเหตุก่อนรัน
--   1. สคริปต์นี้สร้างข้อมูลจริง (สินค้า TEST-*, รอบขาย และบิลทดสอบ ~4 ใบ)
--      ตั้งใจให้เป็นแบบนี้ เพราะต้องพิสูจน์ว่าบันทึกลงฐานข้อมูลได้จริง
--      ถ้าต้องการฐานสะอาดให้ reset database แล้วรัน 001-007 ใหม่
--   2. ข้อ 3 ต้องรัน 009_rpc_returns.sql (create_return, void_sale) ก่อน
--   3. ข้อ 1 เวอร์ชันยิงพร้อมกันจริงต้องใช้ SQL Editor สองแท็บ — วิธีทำอยู่ท้ายไฟล์
-- =====================================================================

-- Supabase SQL Editor รันแต่ละ statement แยกกัน ตาราง temp จึงอยู่ไม่ข้ามคำสั่ง
-- ไฟล์นี้จึงเก็บผลลัพธ์ในตารางธรรมดาแล้วลบทิ้งท้ายไฟล์
drop table if exists public._aunchan_test_results;
create table public._aunchan_test_results (
  test_no  text,
  name     text,
  expected text,
  actual   text,
  result   text
);

-- ---------------------------------------------------------------------
-- fixture: สินค้าสำหรับทดสอบโดยเฉพาะ ไม่ไปรบกวนสินค้าตัวอย่าง
--   TEST-001 ราคา 12.50 → ใช้ทดสอบการปัดเศษ VAT ที่ลงท้าย .005
--   TEST-002 ราคา 50.00 → ใช้ทดสอบชิ้นสุดท้าย (ตั้งสต็อกไว้ 1 ชิ้น)
-- สร้างสต็อกด้วย movement คู่กับ inventory เสมอ เพื่อไม่ให้ §7.1 พัง
-- ---------------------------------------------------------------------
do $$
declare
  v_owner uuid;
  v_id    uuid;
begin
  select id into v_owner from public.staff where email = 'owner@aunchan.local';

  insert into public.products (name, sku, category, unit, cost_price, price, is_vat_exempt, is_active)
  values ('สินค้าทดสอบปัดเศษ', 'TEST-001', 'อุปกรณ์', 'ชิ้น', 6.00, 12.50, false, true)
  on conflict (sku) do nothing;

  insert into public.products (name, sku, category, unit, cost_price, price, is_vat_exempt, is_active)
  values ('สินค้าทดสอบชิ้นสุดท้าย', 'TEST-002', 'อุปกรณ์', 'ชิ้น', 25.00, 50.00, false, true)
  on conflict (sku) do nothing;

  -- TEST-001: เติมให้มีอย่างน้อย 100 ชิ้น
  select id into v_id from public.products where sku = 'TEST-001';
  insert into public.inventory (product_id, quantity, reorder_point)
  values (v_id, 0, 5) on conflict (product_id) do nothing;

  if (select quantity from public.inventory where product_id = v_id) < 100 then
    insert into public.stock_movements (product_id, type, qty_change, reason, unit_cost, staff_id)
    values (v_id, 'receive',
            100 - (select quantity from public.inventory where product_id = v_id),
            'เติมสต็อกสำหรับชุดทดสอบ', 6.00, v_owner);
    update public.inventory set quantity = 100 where product_id = v_id;
  end if;

  -- TEST-002: ตั้งให้เหลือ 1 ชิ้นพอดี
  select id into v_id from public.products where sku = 'TEST-002';
  insert into public.inventory (product_id, quantity, reorder_point)
  values (v_id, 0, 5) on conflict (product_id) do nothing;

  if (select quantity from public.inventory where product_id = v_id) <> 1 then
    insert into public.stock_movements (product_id, type, qty_change, reason, staff_id)
    values (v_id, 'adjust',
            1 - (select quantity from public.inventory where product_id = v_id),
            'ตั้งค่าสต็อกสำหรับชุดทดสอบชิ้นสุดท้าย', v_owner);
    update public.inventory set quantity = 1 where product_id = v_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 1 — แย่งชิ้นสุดท้าย (เวอร์ชันลำดับเดียว)
-- สินค้าเหลือ 1 ชิ้น: บิลแรกต้องผ่าน บิลที่สองต้องล้มทั้งใบ และสต็อกเหลือ 0 ไม่ติดลบ
-- ---------------------------------------------------------------------
do $$
declare
  v_staff  uuid;
  v_shift  uuid;
  v_prod   uuid;
  v_first  public.sales;
  v_qty    integer;
  v_err    text := '(ไม่เกิด error)';
  v_ok     boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_prod  from public.products where sku = 'TEST-002';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  v_first := public.checkout_sale(
    gen_random_uuid(), v_shift,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)),
    'cash', 100, 0);

  begin
    perform public.checkout_sale(
      gen_random_uuid(), v_shift,
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)),
      'cash', 100, 0);
  exception when others then
    v_err := sqlerrm;
  end;

  perform set_config('role', 'postgres', true);

  select quantity into v_qty from public.inventory where product_id = v_prod;
  v_ok := v_first.id is not null and v_err like 'สต็อกไม่พอ%' and v_qty = 0;

  insert into public._aunchan_test_results values (
    '1',
    'ชิ้นสุดท้าย: ปิดบิลสองครั้งติดกันเมื่อเหลือ 1 ชิ้น',
    'บิลแรกสำเร็จ · บิลที่สอง raise "สต็อกไม่พอ" · คงเหลือ 0',
    format('บิลแรก %s · ครั้งที่สอง: %s · คงเหลือ %s', v_first.receipt_no, v_err, v_qty),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('1', 'ชิ้นสุดท้าย', 'บิลแรกสำเร็จ บิลที่สองล้ม', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 2 — โปรโมชั่นซ้อน (ลด 10% ปากกาเจล P003 + ซื้อครบ 300 ลด 30)
-- ซื้อ P003 จำนวน 20 ชิ้น ราคา 20.00 → 400.00
--   ลด 10% รายสินค้า  → subtotal        360.00   (item_discount 40.00)
--   ถึงเกณฑ์ 300      → bill_discount    30.00
--   taxable           → 330.00
--   VAT 7%            →  23.10
--   total             → 353.10
-- และผลรวม line_total_excl_vat ต้องเท่ากับ subtotal - bill_discount เป๊ะ
-- ---------------------------------------------------------------------
do $$
declare
  v_staff uuid;
  v_shift uuid;
  v_prod  uuid;
  v_sale  public.sales;
  v_lines numeric(10,2);
  v_ok    boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_prod  from public.products where sku = 'P003';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  v_sale := public.checkout_sale(
    gen_random_uuid(), v_shift,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 20)),
    'cash', 400, 0);

  perform set_config('role', 'postgres', true);

  select coalesce(sum(line_total_excl_vat), 0) into v_lines
  from public.sale_items where sale_id = v_sale.id;

  v_ok := v_sale.subtotal = 360.00
      and v_sale.item_discount = 40.00
      and v_sale.bill_discount = 30.00
      and v_sale.vat_amount = 23.10
      and v_sale.total_amount = 353.10
      and v_lines = v_sale.subtotal - v_sale.bill_discount;

  insert into public._aunchan_test_results values (
    '2',
    'โปรโมชั่นซ้อน: ลด 10% รายสินค้า แล้วซื้อครบ 300 ลด 30',
    'subtotal 360.00 · item 40.00 · bill 30.00 · VAT 23.10 · total 353.10 · Σรายการ 330.00',
    format('subtotal %s · item %s · bill %s · VAT %s · total %s · Σรายการ %s',
           v_sale.subtotal, v_sale.item_discount, v_sale.bill_discount,
           v_sale.vat_amount, v_sale.total_amount, v_lines),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('2', 'โปรโมชั่นซ้อน', 'ตัวเลขตรงลำดับ §4', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 3 — คืนบางรายการ (ใช้ create_return จาก 009_rpc_returns.sql)
-- staff ปิดบิล TEST-001 × 4 + P001 × 2 แล้ว owner รับคืน TEST-001 เพียง 1 ชิ้น
-- ต้องได้: สต็อก TEST-001 +1 · สต็อก P001 เท่าเดิม · returned_qty = 1
--          สถานะบิล = partially_returned · คืนเกินจำนวนที่เหลือถูกปฏิเสธ
-- ---------------------------------------------------------------------
do $$
declare
  v_staff     uuid;
  v_owner     uuid;
  v_shift     uuid;
  v_t1        uuid;
  v_p1        uuid;
  v_sale      public.sales;
  v_item_t1   uuid;
  v_qty_t1    integer;
  v_qty_p1    integer;
  v_after_t1  integer;
  v_after_p1  integer;
  v_returned  integer;
  v_status    text;
  v_refund    numeric(10,2);
  v_result    jsonb;
  v_err       text := '(ไม่เกิด error)';
  v_ok        boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_owner from public.staff where email = 'owner@aunchan.local';
  select id into v_t1    from public.products where sku = 'TEST-001';
  select id into v_p1    from public.products where sku = 'P001';

  -- --- ขายก่อน (สวมบทบาท staff) ---
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  v_sale := public.checkout_sale(
    gen_random_uuid(), v_shift,
    jsonb_build_array(
      jsonb_build_object('product_id', v_t1, 'quantity', 4),
      jsonb_build_object('product_id', v_p1, 'quantity', 2)),
    'cash', 500, 0);

  perform set_config('role', 'postgres', true);

  select quantity into v_qty_t1 from public.inventory where product_id = v_t1;
  select quantity into v_qty_p1 from public.inventory where product_id = v_p1;
  select id into v_item_t1 from public.sale_items where sale_id = v_sale.id and product_id = v_t1;

  -- --- คืน 1 ชิ้น (สวมบทบาท owner เพราะการคืนเป็นสิทธิ์ owner §2) ---
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_result := public.create_return(
    v_sale.id,
    jsonb_build_array(jsonb_build_object(
      'sale_item_id', v_item_t1, 'quantity', 1, 'restock', true)),
    'ทดสอบคืนบางรายการ');

  -- --- คืนเกินจำนวนที่เหลือ ต้องถูกปฏิเสธ ---
  begin
    perform public.create_return(
      v_sale.id,
      jsonb_build_array(jsonb_build_object(
        'sale_item_id', v_item_t1, 'quantity', 99, 'restock', true)),
      'ทดสอบคืนเกิน');
  exception when others then
    v_err := sqlerrm;
  end;

  perform set_config('role', 'postgres', true);

  select quantity into v_after_t1 from public.inventory where product_id = v_t1;
  select quantity into v_after_p1 from public.inventory where product_id = v_p1;
  select returned_qty into v_returned from public.sale_items where id = v_item_t1;
  select status into v_status from public.sales where id = v_sale.id;
  v_refund := (v_result ->> 'refund_amount')::numeric;

  v_ok := v_after_t1 = v_qty_t1 + 1
      and v_after_p1 = v_qty_p1
      and v_returned = 1
      and v_status = 'partially_returned'
      and v_refund > 0
      and v_refund < v_sale.total_amount
      and v_err like 'คืนได้ไม่เกิน%';

  insert into public._aunchan_test_results values (
    '3',
    'คืนบางรายการ: สต็อกเพิ่มเฉพาะตัวที่คืน · สถานะเป็น partially_returned · คืนเกินถูกปฏิเสธ',
    format('TEST-001 %s→%s · P001 %s คงเดิม · returned_qty 1 · partially_returned · คืนเงิน < %s · คืนเกินถูกปฏิเสธ',
           v_qty_t1, v_qty_t1 + 1, v_qty_p1, v_sale.total_amount),
    format('TEST-001 %s→%s · P001 %s→%s · returned_qty %s · %s · คืนเงิน %s · คืนเกิน: %s',
           v_qty_t1, v_after_t1, v_qty_p1, v_after_p1, v_returned, v_status, v_refund, v_err),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('3', 'คืนบางรายการ', 'คืนสำเร็จและคืนเกินถูกปฏิเสธ', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 3ข (เสริม) — ยกเลิกบิลทั้งใบด้วย void_sale
-- ต้องได้: สต็อกกลับมาครบทุกชิ้น · สถานะ voided · ยกเลิกซ้ำถูกปฏิเสธ
--          และบิลที่มีการคืนแล้วยกเลิกไม่ได้
-- ---------------------------------------------------------------------
do $$
declare
  v_staff    uuid;
  v_owner    uuid;
  v_shift    uuid;
  v_t1       uuid;
  v_sale     public.sales;
  v_before   integer;
  v_after    integer;
  v_status   text;
  v_err      text := '(ไม่เกิด error)';
  v_err2     text := '(ไม่เกิด error)';
  v_returned uuid;
  v_ok       boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_owner from public.staff where email = 'owner@aunchan.local';
  select id into v_t1    from public.products where sku = 'TEST-001';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  v_sale := public.checkout_sale(
    gen_random_uuid(), v_shift,
    jsonb_build_array(jsonb_build_object('product_id', v_t1, 'quantity', 3)),
    'cash', 500, 0);

  perform set_config('role', 'postgres', true);
  select quantity into v_before from public.inventory where product_id = v_t1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.void_sale(v_sale.id, 'ทดสอบยกเลิกบิล');

  -- ยกเลิกซ้ำต้องถูกปฏิเสธ
  begin
    perform public.void_sale(v_sale.id, 'ทดสอบยกเลิกซ้ำ');
  exception when others then
    v_err := sqlerrm;
  end;

  -- บิลที่คืนสินค้าไปแล้ว (จากข้อ 3) ยกเลิกทั้งใบไม่ได้
  select r.sale_id into v_returned from public.returns r
  where r.reason = 'ทดสอบคืนบางรายการ' order by r.created_at desc limit 1;

  if v_returned is not null then
    begin
      perform public.void_sale(v_returned, 'ทดสอบยกเลิกบิลที่คืนแล้ว');
    exception when others then
      v_err2 := sqlerrm;
    end;
  end if;

  perform set_config('role', 'postgres', true);

  select quantity into v_after from public.inventory where product_id = v_t1;
  select status into v_status from public.sales where id = v_sale.id;

  v_ok := v_after = v_before + 3
      and v_status = 'voided'
      and v_err like '%ถูกยกเลิกไปแล้ว%'
      and v_err2 like '%มีการคืนสินค้าไปแล้ว%';

  insert into public._aunchan_test_results values (
    '3ข',
    'ยกเลิกบิล: คืนของเข้าสต็อกครบ · สถานะ voided · ยกเลิกซ้ำ/ยกเลิกบิลที่คืนแล้วถูกปฏิเสธ',
    format('สต็อก %s→%s · voided · ปฏิเสธทั้งสองกรณี', v_before, v_before + 3),
    format('สต็อก %s→%s · %s · ซ้ำ: %s · บิลที่คืนแล้ว: %s',
           v_before, v_after, v_status, v_err, v_err2),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('3ข', 'ยกเลิกบิล', 'สต็อกกลับครบและสถานะ voided', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 4 — ปัดเศษ: บิลที่ VAT ลงท้าย .005 ต้องปัด half-up ที่ระดับบิลครั้งเดียว
-- TEST-001 ราคา 12.50 × 1 ชิ้น → VAT = 12.50 × 7% = 0.875 → ต้องได้ 0.88
-- และ subtotal - ส่วนลด + vat_amount = total_amount เสมอ
-- ---------------------------------------------------------------------
do $$
declare
  v_staff uuid;
  v_shift uuid;
  v_prod  uuid;
  v_sale  public.sales;
  v_ok    boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_prod  from public.products where sku = 'TEST-001';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  v_sale := public.checkout_sale(
    gen_random_uuid(), v_shift,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)),
    'cash', 20, 0);

  perform set_config('role', 'postgres', true);

  v_ok := v_sale.subtotal = 12.50
      and v_sale.vat_amount = 0.88
      and v_sale.total_amount = 13.38
      and v_sale.total_amount = v_sale.subtotal - v_sale.bill_discount
                              - v_sale.manual_discount + v_sale.vat_amount;

  insert into public._aunchan_test_results values (
    '4',
    'ปัดเศษ: VAT ของ 12.50 = 0.875 ต้องปัดขึ้นเป็น 0.88 ครั้งเดียวที่ระดับบิล',
    'subtotal 12.50 · VAT 0.88 · total 13.38 · สมการยอดบิลสมดุล',
    format('subtotal %s · VAT %s · total %s', v_sale.subtotal, v_sale.vat_amount, v_sale.total_amount),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('4', 'ปัดเศษ', 'VAT 0.88 · total 13.38', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 5 — กดยืนยันซ้ำ: ส่ง client_uuid เดิมสองครั้ง ต้องได้บิลเดียว
-- ---------------------------------------------------------------------
do $$
declare
  v_staff  uuid;
  v_shift  uuid;
  v_prod   uuid;
  v_client uuid := gen_random_uuid();
  v_a      public.sales;
  v_b      public.sales;
  v_count  integer;
  v_ok     boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_prod  from public.products where sku = 'TEST-001';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  v_a := public.checkout_sale(v_client, v_shift,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 2)), 'cash', 100, 0);

  v_b := public.checkout_sale(v_client, v_shift,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 2)), 'cash', 100, 0);

  perform set_config('role', 'postgres', true);

  select count(*) into v_count from public.sales where client_uuid = v_client;
  v_ok := v_a.id = v_b.id and v_count = 1;

  insert into public._aunchan_test_results values (
    '5',
    'กดยืนยันซ้ำ: ส่ง client_uuid เดิมสองครั้ง',
    'ได้บิลเดียว ครั้งที่สองคืนบิลเดิม (ไม่ใช่ error)',
    format('บิลที่ได้ %s · จำนวนแถวใน sales = %s · id ตรงกัน = %s',
           v_a.receipt_no, v_count, v_a.id = v_b.id),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('5', 'กดยืนยันซ้ำ', 'ได้บิลเดียว', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 6 — staff เรียกสิ่งที่เป็นสิทธิ์ owner ต้องถูกปฏิเสธที่ฐานข้อมูล
--   6.1 ส่ง p_manual_discount เข้า checkout_sale
--   6.2 เขียน stock_movements ตรง ๆ ผ่าน client
--   6.3 อ่านตาราง products (มีคอลัมน์ต้นทุน) ต้องได้ 0 แถว
--   (adjust_stock / create_return อยู่ใน P1 จะทดสอบเพิ่มตอนนั้น)
-- ---------------------------------------------------------------------
do $$
declare
  v_staff  uuid;
  v_shift  uuid;
  v_prod   uuid;
  v_e1     text := '(ไม่เกิด error)';
  v_e2     text := '(ไม่เกิด error)';
  v_rows   integer;
  v_ok     boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_prod  from public.products where sku = 'TEST-001';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;
  if v_shift is null then
    v_shift := (public.open_shift(1000)).id;
  end if;

  begin
    perform public.checkout_sale(gen_random_uuid(), v_shift,
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)),
      'cash', 100, 50);
  exception when others then
    v_e1 := sqlerrm;
  end;

  begin
    insert into public.stock_movements (product_id, type, qty_change, reason, staff_id)
    values (v_prod, 'adjust', 99, 'พนักงานแอบปรับสต็อก', v_staff);
  exception when others then
    v_e2 := sqlerrm;
  end;

  select count(*) into v_rows from public.products;

  perform set_config('role', 'postgres', true);

  v_ok := v_e1 like '%ส่วนลดกดมือเป็นสิทธิ์ของเจ้าของร้าน%'
      and v_e2 <> '(ไม่เกิด error)'
      and v_rows = 0;

  insert into public._aunchan_test_results values (
    '6',
    'staff ทำสิ่งที่เป็นสิทธิ์ owner: ส่งส่วนลดกดมือ · เขียน stock_movements · อ่านตาราง products',
    'ถูกปฏิเสธทั้งสามอย่าง (products อ่านได้ 0 แถว)',
    format('ส่วนลดกดมือ: %s | เขียน movement: %s | อ่าน products ได้ %s แถว', v_e1, v_e2, v_rows),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('6', 'staff เรียกสิทธิ์ owner', 'ถูกปฏิเสธที่ฐานข้อมูล', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 7 — staff query บิลของรอบขายคนอื่นต้องได้ 0 แถว
-- ---------------------------------------------------------------------
do $$
declare
  v_staff   uuid;
  v_owner   uuid;
  v_others  integer;
  v_mine    integer;
  v_total   integer;
  v_ok      boolean;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_owner from public.staff where email = 'owner@aunchan.local';

  select count(*) into v_total
  from public.sales s join public.shifts sh on sh.id = s.shift_id
  where sh.staff_id = v_owner;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_others
  from public.sales s join public.shifts sh on sh.id = s.shift_id
  where sh.staff_id = v_owner;

  select count(*) into v_mine
  from public.sales s join public.shifts sh on sh.id = s.shift_id
  where sh.staff_id = v_staff;

  perform set_config('role', 'postgres', true);

  v_ok := v_others = 0 and v_mine > 0 and v_total > 0;

  insert into public._aunchan_test_results values (
    '7',
    'staff อ่านบิลของรอบขายคนอื่น',
    format('เห็นบิลของ owner 0 แถว (ในฐานข้อมูลมีจริง %s แถว) และเห็นบิลของตัวเองได้', v_total),
    format('เห็นบิลของ owner %s แถว · เห็นบิลของตัวเอง %s แถว', v_others, v_mine),
    case when v_ok then 'ผ่าน' else 'ไม่ผ่าน' end);

exception when others then
  perform set_config('role', 'postgres', true);
  insert into public._aunchan_test_results values ('7', 'staff อ่านบิลคนอื่น', '0 แถว', sqlerrm, 'ไม่ผ่าน');
end $$;

-- ---------------------------------------------------------------------
-- ข้อ 8 — inventory.quantity = SUM(stock_movements.qty_change) ทุกสินค้า
-- ---------------------------------------------------------------------
do $$
declare
  v_bad     integer;
  v_detail  text;
begin
  select count(*), coalesce(string_agg(sku, ', '), '-')
    into v_bad, v_detail
  from (
    select p.sku
    from public.products p
    join public.inventory inv on inv.product_id = p.id
    left join public.stock_movements sm on sm.product_id = p.id
    group by p.sku, inv.quantity
    having inv.quantity <> coalesce(sum(sm.qty_change), 0)
  ) x;

  insert into public._aunchan_test_results values (
    '8',
    'สต็อกตรงกับรายการเคลื่อนไหวทุกสินค้า (หลังรันบิลทดสอบทั้งหมดแล้ว)',
    '0 รายการที่ไม่ตรง',
    format('%s รายการที่ไม่ตรง (%s)', v_bad, v_detail),
    case when v_bad = 0 then 'ผ่าน' else 'ไม่ผ่าน' end);
end $$;

-- ---------------------------------------------------------------------
-- ปิดรอบขายที่เปิดไว้ระหว่างทดสอบ เพื่อให้ฐานข้อมูลกลับสู่สภาพเรียบร้อย
-- ---------------------------------------------------------------------
do $$
declare
  v_staff uuid;
  v_shift uuid;
begin
  select id into v_staff from public.staff where email = 'staff@aunchan.local';
  select id into v_shift from public.shifts where staff_id = v_staff and closed_at is null limit 1;

  if v_shift is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    perform public.close_shift(v_shift, 0);
    perform set_config('role', 'postgres', true);
  end if;
end $$;

-- =====================================================================
-- ตารางสรุปผล
-- =====================================================================
select test_no as "ข้อ",
       name    as "วิธีทดสอบ",
       expected as "ค่าที่คาด",
       actual   as "ผลจริง",
       result   as "ผ่านหรือไม่"
from public._aunchan_test_results
order by test_no;

-- เมื่อคัดลอกตารางผลลัพธ์ข้างบนไปแล้ว ลบตารางช่วยทิ้งได้เลย
-- drop table if exists public._aunchan_test_results;

-- =====================================================================
-- ข้อ 1 เวอร์ชันยิงพร้อมกันจริง (ต้องใช้ SQL Editor สองแท็บ)
-- =====================================================================
-- เตรียม: ตั้งสต็อก TEST-002 ให้เหลือ 1 ชิ้นอีกครั้ง (fixture ด้านบนทำให้แล้วเมื่อรันซ้ำ)
--
-- แท็บ A:
--   begin;
--   select set_config('request.jwt.claims',
--          json_build_object('sub', (select id from staff where email='staff@aunchan.local'),
--                            'role','authenticated')::text, true);
--   set local role authenticated;
--   select checkout_sale(gen_random_uuid(),
--          (select id from shifts where staff_id = auth.uid() and closed_at is null limit 1),
--          jsonb_build_array(jsonb_build_object('product_id',
--             (select id from products where sku='TEST-002'), 'quantity', 1)),
--          'cash', 100, 0);
--   -- ยังไม่ commit ค้างไว้ก่อน
--
-- แท็บ B: รันบล็อกเดียวกันด้วย owner (ต้องมีรอบขายของ owner เปิดอยู่)
--   → แท็บ B จะค้างรอที่ SELECT ... FOR UPDATE
--
-- แท็บ A: commit;
--   → แท็บ B จะเดินต่อแล้วล้มด้วยข้อความ "สต็อกไม่พอ"
--
-- ตรวจผล: select quantity from inventory
--          where product_id = (select id from products where sku='TEST-002');
--   → ต้องได้ 0 ไม่ใช่ -1
-- =====================================================================
