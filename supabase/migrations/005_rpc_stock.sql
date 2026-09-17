-- =====================================================================
-- Aunchan POS — 005_rpc_stock.sql
-- RPC จัดการสต็อก: receive_stock, adjust_stock, record_waste (§7.8)
-- concern เดียว: การเปลี่ยนแปลงสต็อกที่ไม่ใช่การขาย
-- รันซ้ำได้อย่างปลอดภัย (create or replace)
-- =====================================================================
--
-- กฎร่วมของทุกฟังก์ชันในไฟล์นี้
--   1. owner เท่านั้น (§2 แก้ยอดสต็อก / รับสินค้าเข้า)
--   2. เป็นธุรกรรมเดียว และเขียน stock_movements คู่กับ inventory เสมอ (§7.1)
--   3. ล็อกแถว inventory ด้วย FOR UPDATE ก่อนอ่านค่าเดิมทุกครั้ง
--   4. ทุก UPDATE ต้องมี WHERE เพราะ Supabase เปิดส่วนขยาย safeupdate
--      ให้ role authenticated ซึ่งปฏิเสธ UPDATE ที่ไม่มี WHERE
--
-- receive_stock
--   input : p_supplier_id uuid (null ได้), p_items jsonb [{product_id, quantity, unit_cost}]
--   output: jsonb array [{product_id, sku, name, quantity, cost_price}] = ค่าหลังรับเข้าจริง
--   error : ไม่มีสิทธิ์ / ไม่มีรายการ / รูปแบบไม่ถูกต้อง / จำนวนต้องมากกว่าศูนย์ /
--           ต้นทุนติดลบ / ไม่พบสินค้า / ไม่พบซัพพลายเออร์
--   สิทธิ์ : owner
--   ต้นทุน: ถัวเฉลี่ยถ่วงน้ำหนักตาม §4
--           new_cost = (old_qty * old_cost + recv_qty * recv_cost) / (old_qty + recv_qty)
--
-- adjust_stock
--   input : p_product_id uuid, p_new_quantity integer, p_reason text
--   output: jsonb {product_id, old_quantity, new_quantity, qty_change}
--   error : ไม่มีสิทธิ์ / ไม่พบสินค้า / จำนวนใหม่ติดลบ / ต้องระบุเหตุผล / ยอดไม่เปลี่ยน
--   สิทธิ์ : owner
--
-- record_waste
--   input : p_product_id uuid, p_quantity integer, p_reason text
--   output: jsonb {product_id, quantity_before, quantity_after, wasted}
--   error : ไม่มีสิทธิ์ / ไม่พบสินค้า / จำนวนต้องมากกว่าศูนย์ / ต้องระบุเหตุผล / สต็อกไม่พอ
--   สิทธิ์ : owner
-- =====================================================================

-- ---------------------------------------------------------------------
-- receive_stock — รับสินค้าเข้า + คำนวณต้นทุนถัวเฉลี่ยถ่วงน้ำหนักใหม่
-- ---------------------------------------------------------------------
create or replace function public.receive_stock(p_supplier_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id  uuid := auth.uid();
  v_now       timestamptz := now();
  v_item      jsonb;
  v_product   public.products;
  v_old_qty   integer;
  v_recv_qty  integer;
  v_recv_cost numeric(10,2);
  v_new_cost  numeric(10,2);
  v_result    jsonb := '[]'::jsonb;
begin
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนรับสินค้าเข้า';
  end if;

  if not public.is_owner() then
    raise exception 'รับสินค้าเข้าเป็นสิทธิ์ของเจ้าของร้านเท่านั้น';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'ไม่มีรายการสินค้าที่จะรับเข้า';
  end if;

  if p_supplier_id is not null
     and not exists (select 1 from public.suppliers s where s.id = p_supplier_id) then
    raise exception 'ไม่พบซัพพลายเออร์ที่ระบุ';
  end if;

  -- ล็อกแถว inventory ของสินค้าทุกตัวในใบรับก่อน เรียงตาม product_id กัน deadlock
  perform 1
  from public.inventory inv
  where inv.product_id in (
    select (i ->> 'product_id')::uuid from jsonb_array_elements(p_items) i
  )
  order by inv.product_id
  for update;

  -- วนทีละรายการตามลำดับที่ส่งมา เพื่อให้ต้นทุนถัวเฉลี่ยถูกคิดต่อเนื่อง
  -- (ส่งสินค้าตัวเดียวกันซ้ำหลายบรรทัดด้วยต้นทุนต่างกันก็ยังถูกต้อง)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if v_item ->> 'product_id' is null
       or v_item ->> 'quantity' is null
       or v_item ->> 'unit_cost' is null then
      raise exception 'รูปแบบรายการไม่ถูกต้อง (ต้องมี product_id, quantity และ unit_cost)';
    end if;

    v_recv_qty  := (v_item ->> 'quantity')::integer;
    v_recv_cost := public.round_half_up((v_item ->> 'unit_cost')::numeric, 2);

    if v_recv_qty <= 0 then
      raise exception 'จำนวนที่รับเข้าต้องมากกว่าศูนย์';
    end if;
    if v_recv_cost < 0 then
      raise exception 'ต้นทุนต่อหน่วยต้องไม่ติดลบ';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid;

    if not found then
      raise exception 'ไม่พบสินค้ารหัส %', v_item ->> 'product_id';
    end if;

    select inv.quantity into v_old_qty
    from public.inventory inv
    where inv.product_id = v_product.id;

    if v_old_qty is null then
      insert into public.inventory (product_id, quantity, reorder_point)
      values (v_product.id, 0, 5);
      v_old_qty := 0;
    end if;

    -- ต้นทุนถัวเฉลี่ยถ่วงน้ำหนัก (§4 ต้นทุนและกำไร)
    v_new_cost := public.round_half_up(
      ((v_old_qty * v_product.cost_price) + (v_recv_qty * v_recv_cost))
      / (v_old_qty + v_recv_qty), 2);

    update public.products
    set cost_price = v_new_cost
    where id = v_product.id;

    update public.inventory
    set quantity   = quantity + v_recv_qty,
        updated_at = v_now
    where product_id = v_product.id;

    insert into public.stock_movements (
      product_id, type, qty_change, ref_table, ref_id, reason, unit_cost, staff_id, created_at
    ) values (
      v_product.id, 'receive', v_recv_qty,
      case when p_supplier_id is not null then 'suppliers' end, p_supplier_id,
      null, v_recv_cost, v_staff_id, v_now
    );

    v_result := v_result || jsonb_build_object(
      'product_id', v_product.id,
      'sku',        v_product.sku,
      'name',       v_product.name,
      'received',   v_recv_qty,
      'quantity',   (select quantity from public.inventory where product_id = v_product.id),
      'cost_price', v_new_cost
    );
  end loop;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- adjust_stock — ปรับยอดให้ตรงกับของจริง เขียน movement ด้วยผลต่าง
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_new_quantity integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_old_qty  integer;
  v_diff     integer;
  v_name     text;
begin
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนปรับยอดสต็อก';
  end if;

  if not public.is_owner() then
    raise exception 'การปรับยอดสต็อกเป็นสิทธิ์ของเจ้าของร้านเท่านั้น';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ต้องระบุเหตุผลในการปรับยอดสต็อก';
  end if;

  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'ยอดคงเหลือใหม่ต้องไม่ติดลบ';
  end if;

  select p.name into v_name from public.products p where p.id = p_product_id;
  if not found then
    raise exception 'ไม่พบสินค้าที่ระบุ';
  end if;

  select inv.quantity into v_old_qty
  from public.inventory inv
  where inv.product_id = p_product_id
  for update;

  if not found then
    raise exception 'ไม่พบข้อมูลสต็อกของสินค้านี้';
  end if;

  v_diff := p_new_quantity - v_old_qty;
  if v_diff = 0 then
    raise exception 'ยอดคงเหลือใหม่เท่ากับยอดเดิม (% ชิ้น) ไม่มีอะไรต้องปรับ', v_old_qty;
  end if;

  insert into public.stock_movements (
    product_id, type, qty_change, reason, staff_id
  ) values (
    p_product_id, 'adjust', v_diff, btrim(p_reason), v_staff_id
  );

  update public.inventory
  set quantity   = p_new_quantity,
      updated_at = now()
  where product_id = p_product_id;

  return jsonb_build_object(
    'product_id',   p_product_id,
    'name',         v_name,
    'old_quantity', v_old_qty,
    'new_quantity', p_new_quantity,
    'qty_change',   v_diff
  );
end;
$$;

-- ---------------------------------------------------------------------
-- record_waste — บันทึกของเสีย/ของชำรุด ตัดออกจากสต็อกพร้อมเหตุผล
-- ---------------------------------------------------------------------
create or replace function public.record_waste(
  p_product_id uuid,
  p_quantity integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_old_qty  integer;
  v_name     text;
begin
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนบันทึกของเสีย';
  end if;

  if not public.is_owner() then
    raise exception 'การบันทึกของเสียเป็นสิทธิ์ของเจ้าของร้านเท่านั้น';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ต้องระบุเหตุผลในการบันทึกของเสีย';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'จำนวนของเสียต้องมากกว่าศูนย์';
  end if;

  select p.name into v_name from public.products p where p.id = p_product_id;
  if not found then
    raise exception 'ไม่พบสินค้าที่ระบุ';
  end if;

  select inv.quantity into v_old_qty
  from public.inventory inv
  where inv.product_id = p_product_id
  for update;

  if not found then
    raise exception 'ไม่พบข้อมูลสต็อกของสินค้านี้';
  end if;

  if v_old_qty < p_quantity then
    raise exception 'สต็อกไม่พอ: % คงเหลือ % ชิ้น ต้องการตัด % ชิ้น', v_name, v_old_qty, p_quantity;
  end if;

  insert into public.stock_movements (
    product_id, type, qty_change, reason, staff_id
  ) values (
    p_product_id, 'waste', -p_quantity, btrim(p_reason), v_staff_id
  );

  update public.inventory
  set quantity   = quantity - p_quantity,
      updated_at = now()
  where product_id = p_product_id;

  return jsonb_build_object(
    'product_id',      p_product_id,
    'name',            v_name,
    'quantity_before', v_old_qty,
    'quantity_after',  v_old_qty - p_quantity,
    'wasted',          p_quantity
  );
end;
$$;

-- ---------------------------------------------------------------------
-- สิทธิ์การเรียก — RLS กันชั้นในอยู่แล้ว แต่ปิดไม่ให้ anon เรียกได้ตั้งแต่แรก
-- ---------------------------------------------------------------------
revoke all on function public.receive_stock(uuid, jsonb)          from public, anon;
revoke all on function public.adjust_stock(uuid, integer, text)   from public, anon;
revoke all on function public.record_waste(uuid, integer, text)   from public, anon;
grant execute on function public.receive_stock(uuid, jsonb)        to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;
grant execute on function public.record_waste(uuid, integer, text) to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
declare
  v_missing text := '';
begin
  if to_regprocedure('public.receive_stock(uuid,jsonb)') is null then
    v_missing := v_missing || 'receive_stock ';
  end if;
  if to_regprocedure('public.adjust_stock(uuid,integer,text)') is null then
    v_missing := v_missing || 'adjust_stock ';
  end if;
  if to_regprocedure('public.record_waste(uuid,integer,text)') is null then
    v_missing := v_missing || 'record_waste ';
  end if;

  if v_missing <> '' then
    raise exception '005_rpc_stock: สร้างฟังก์ชันไม่ครบ: %', v_missing;
  end if;

  raise notice '005_rpc_stock: สร้าง receive_stock, adjust_stock, record_waste แล้ว';
end $$;
