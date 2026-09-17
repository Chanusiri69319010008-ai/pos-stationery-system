-- =====================================================================
-- Aunchan POS — 009_rpc_returns.sql
-- RPC คืนสินค้าและยกเลิกบิล: create_return, void_sale (§7.8)
-- concern เดียว: การย้อนรายการขายที่ปิดบิลไปแล้ว
-- รันซ้ำได้อย่างปลอดภัย (create or replace)
-- =====================================================================
--
-- กฎร่วมของทั้งสองฟังก์ชัน
--   1. owner เท่านั้น (§2 คืนสินค้า/ยกเลิกบิล เป็นสิทธิ์เจ้าของร้าน)
--   2. เป็นธุรกรรมเดียว — คืนเงิน คืนสต็อก และเปลี่ยนสถานะบิล ต้องสำเร็จพร้อมกัน
--   3. ล็อกแถว sales และ sale_items ด้วย FOR UPDATE ก่อนอ่านค่าเดิม
--   4. ทุก UPDATE มี WHERE เสมอ (Supabase เปิดส่วนขยาย safeupdate ให้ authenticated)
--   5. ห้ามลบแถวใด ๆ — บิลเดิมยังอยู่ครบ เปลี่ยนแค่ status และ returned_qty (§4)
--
-- create_return
--   input : p_sale_id uuid
--           p_items jsonb [{sale_item_id, quantity, restock}]  restock ไม่ใส่ = true
--           p_reason text
--   output: jsonb {return_id, shift_id, receipt_no, refund_amount, refund_method,
--                  sale_status, items:[{sale_item_id, name, quantity, restock, refund_amount}]}
--   error : ไม่มีสิทธิ์ / ไม่ระบุเหตุผล / ไม่มีรายการ / ไม่พบบิล / บิลถูกยกเลิกแล้ว /
--           คืนครบแล้ว / รายการไม่ได้อยู่ในบิลนี้ / ส่งสินค้าซ้ำในใบเดียว /
--           จำนวนต้องมากกว่าศูนย์ / คืนเกินจำนวนที่เหลือ / คืนเงินสดโดยไม่มีรอบขายเปิดอยู่
--   สิทธิ์ : owner
--
--   shift_id ของใบคืน = รอบขายที่เงินออกจากลิ้นชักจริง ไม่ใช่รอบของบิลเดิม
--     ลำดับการเลือก: รอบที่ผู้ทำรายการเปิดค้างอยู่ → รอบของบิลเดิมถ้ายังไม่ปิด
--     ถ้าไม่มีทั้งสองอย่างและต้องคืนเป็นเงินสด จะถูกปฏิเสธ ให้เปิดรอบขายก่อน
--     (คืนเป็นพร้อมเพย์ไม่ได้แตะลิ้นชัก จึงปล่อยให้ shift_id ว่างได้)
--
--   สูตรเงินคืน (ต่อยอดจาก §7.5 ที่ใช้ตอนปิดบิล — ไม่ได้คิดราคาใหม่)
--     lines_sum = subtotal - bill_discount   (= ผลรวม line_total_excl_vat ของบิล)
--     factor    = (lines_sum - manual_discount) / lines_sum
--                 เฉลี่ยส่วนลดกดมือลงรายการตามสัดส่วน เพราะตอนปิดบิลไม่ได้เฉลี่ยไว้
--     share_i   = line_total_excl_vat_i * qty_คืน_i / quantity_i
--     taxable   = round_half_up(Σ share_i * factor, 2)
--     vat       = round_half_up(taxable * vat_rate / 100, 2)
--     refund    = taxable + vat            ← ปัดครั้งเดียวที่ระดับใบคืน เหมือนระดับบิล
--   ถ้าการคืนครั้งนี้ทำให้บิลคืนครบทุกชิ้น จะใช้ยอดคงเหลือของบิล
--   (total_amount - เงินคืนครั้งก่อน ๆ) แทน เพื่อให้เงินคืนรวมเท่ากับยอดบิลเป๊ะ
--   ไม่มีเศษสตางค์ค้าง
--
--   restock = true  → คืนของเข้าสต็อก + เขียน stock_movements ชนิด 'return'
--   restock = false → ของเสียคืนไม่ได้ ไม่แตะสต็อกและไม่เขียน movement
--                     (ของชิ้นนี้ถูกตัดออกตอนขายไปแล้ว ถ้าเขียน waste ซ้ำจะตัดสองรอบ)
--
-- void_sale
--   input : p_sale_id uuid, p_reason text
--   output: แถวของตาราง sales หลังเปลี่ยนสถานะ
--   error : ไม่มีสิทธิ์ / ไม่ระบุเหตุผล / ไม่พบบิล / บิลถูกยกเลิกไปแล้ว /
--           บิลมีการคืนสินค้าแล้ว / รอบขายของบิลปิดไปแล้ว
--   สิทธิ์ : owner
--
--   ยกเลิกได้เฉพาะบิลที่ยัง "สะอาด" (status = 'completed' และไม่มีใบคืน)
--   และเฉพาะตอนที่รอบขายของบิลยังไม่ปิด เพราะ close_shift บันทึก expected_cash
--   เป็นค่าคงที่ลงตาราง shifts ไปแล้ว การยกเลิกบิลเงินสดย้อนหลังจะทำให้ยอดที่
--   บันทึกไว้ผิดโดยไม่มีใครรู้ — บิลของรอบที่ปิดแล้วให้ใช้การคืนสินค้าแทน
--   เหตุผลที่กรอกถูกเก็บไว้ที่ stock_movements.reason และ audit_log
--   (ตาราง sales ไม่มีคอลัมน์สำหรับเหตุผล จึงไม่เพิ่มคอลัมน์ใหม่นอกสเปก)
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_return — คืนสินค้าบางส่วนหรือทั้งบิล
-- ---------------------------------------------------------------------
create or replace function public.create_return(
  p_sale_id uuid,
  p_items jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id  uuid := auth.uid();
  v_now       timestamptz := now();
  v_sale      public.sales;
  v_line      public.sale_items;
  v_item      jsonb;
  v_ids       uuid[]    := '{}';
  v_pids      uuid[]    := '{}';
  v_names     text[]    := '{}';
  v_qtys      integer[] := '{}';
  v_restocks  boolean[] := '{}';
  v_costs     numeric[] := '{}';
  v_shares    numeric[] := '{}';
  v_allocs    numeric[] := '{}';
  v_qty       integer;
  v_lines_sum numeric(10,2);
  v_factor    numeric;
  v_share_sum numeric := 0;
  v_taxable   numeric(10,2);
  v_vat       numeric(10,2);
  v_refund    numeric(10,2);
  v_prev      numeric(10,2);
  v_fully     boolean;
  v_return_id uuid;
  v_shift_id  uuid;
  v_alloc_sum numeric(10,2) := 0;
  v_max_idx   integer := 1;
  v_count     integer;
  i           integer;
  v_result    jsonb := '[]'::jsonb;
begin
  -- -------------------------------------------------------------------
  -- 1. สิทธิ์และข้อมูลนำเข้า
  -- -------------------------------------------------------------------
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนรับคืนสินค้า';
  end if;

  if not public.is_owner() then
    raise exception 'การรับคืนสินค้าเป็นสิทธิ์ของเจ้าของร้านเท่านั้น';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ต้องระบุเหตุผลในการคืนสินค้า';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'ไม่มีรายการสินค้าที่จะคืน';
  end if;

  -- -------------------------------------------------------------------
  -- 2. ล็อกบิลและตรวจสถานะ
  -- -------------------------------------------------------------------
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'ไม่พบบิลที่ระบุ';
  end if;

  if v_sale.status = 'voided' then
    raise exception 'บิล % ถูกยกเลิกไปแล้ว คืนสินค้าไม่ได้', v_sale.receipt_no;
  end if;

  if v_sale.status = 'returned' then
    raise exception 'บิล % คืนครบทุกชิ้นไปแล้ว', v_sale.receipt_no;
  end if;

  -- -------------------------------------------------------------------
  -- 3. ตรวจรายการที่จะคืนทีละบรรทัด + เก็บสัดส่วนยอดของแต่ละบรรทัด
  -- -------------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if v_item ->> 'sale_item_id' is null or v_item ->> 'quantity' is null then
      raise exception 'รูปแบบรายการไม่ถูกต้อง (ต้องมี sale_item_id และ quantity)';
    end if;

    if (v_item ->> 'sale_item_id')::uuid = any(v_ids) then
      raise exception 'ส่งรายการเดียวกันซ้ำในใบคืนเดียว ให้รวมจำนวนเป็นบรรทัดเดียว';
    end if;

    select * into v_line
    from public.sale_items
    where id = (v_item ->> 'sale_item_id')::uuid
      and sale_id = p_sale_id
    for update;

    if not found then
      raise exception 'รายการที่จะคืนไม่ได้อยู่ในบิล %', v_sale.receipt_no;
    end if;

    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty <= 0 then
      raise exception 'จำนวนที่คืนต้องมากกว่าศูนย์';
    end if;

    if v_qty > v_line.quantity - v_line.returned_qty then
      raise exception 'คืนได้ไม่เกิน % ชิ้น (ขายไป % ชิ้น คืนไปแล้ว % ชิ้น)',
        v_line.quantity - v_line.returned_qty, v_line.quantity, v_line.returned_qty;
    end if;

    v_ids      := v_ids      || v_line.id;
    v_pids     := v_pids     || v_line.product_id;
    v_names    := v_names    || (select p.name from public.products p where p.id = v_line.product_id);
    v_qtys     := v_qtys     || v_qty;
    v_restocks := v_restocks || coalesce((v_item ->> 'restock')::boolean, true);
    v_costs    := v_costs    || v_line.unit_cost;

    -- สัดส่วนยอดก่อนภาษีของจำนวนที่คืน (ยังไม่ปัด เก็บไว้ปัดครั้งเดียวตอนท้าย)
    v_shares    := v_shares || (v_line.line_total_excl_vat * v_qty / v_line.quantity);
    v_share_sum := v_share_sum + (v_line.line_total_excl_vat * v_qty / v_line.quantity);
  end loop;

  v_count := array_length(v_ids, 1);

  -- -------------------------------------------------------------------
  -- 4. คิดเงินคืน — เฉลี่ยส่วนลดกดมือตามสัดส่วน แล้วบวก VAT กลับ
  -- -------------------------------------------------------------------
  v_lines_sum := v_sale.subtotal - v_sale.bill_discount;

  if v_lines_sum > 0 then
    v_factor := (v_lines_sum - v_sale.manual_discount) / v_lines_sum;
  else
    v_factor := 0;
  end if;

  v_taxable := public.round_half_up(v_share_sum * v_factor, 2);
  v_vat     := public.round_half_up(v_taxable * v_sale.vat_rate / 100, 2);
  v_refund  := v_taxable + v_vat;

  -- -------------------------------------------------------------------
  -- 5. บันทึกจำนวนที่คืนลงรายการของบิล
  -- -------------------------------------------------------------------
  for i in 1..v_count loop
    update public.sale_items
    set returned_qty = returned_qty + v_qtys[i]
    where id = v_ids[i];
  end loop;

  select not exists (
    select 1 from public.sale_items si
    where si.sale_id = p_sale_id and si.returned_qty < si.quantity
  ) into v_fully;

  -- -------------------------------------------------------------------
  -- 6. ปิดเศษ: เงินคืนรวมทุกใบต้องไม่เกินยอดบิล และถ้าคืนครบต้องเท่ากันเป๊ะ
  -- -------------------------------------------------------------------
  select coalesce(sum(r.refund_amount), 0) into v_prev
  from public.returns r
  where r.sale_id = p_sale_id;

  if v_fully or v_prev + v_refund > v_sale.total_amount then
    v_refund := v_sale.total_amount - v_prev;
  end if;

  if v_refund < 0 then
    v_refund := 0;
  end if;

  -- -------------------------------------------------------------------
  -- 7. หารอบขายที่เงินคืนก้อนนี้ควรถูกหักออก
  --    ลำดับ: รอบที่ตัวเองเปิดค้างอยู่ → รอบของบิลเดิมถ้ายังไม่ปิด
  --    เงินสดที่จ่ายคืนต้องมีลิ้นชักรองรับเสมอ ไม่งั้นยอดปิดรอบจะเพี้ยน
  -- -------------------------------------------------------------------
  select sh.id into v_shift_id
  from public.shifts sh
  where sh.staff_id = v_staff_id and sh.closed_at is null
  limit 1;

  if v_shift_id is null then
    select sh.id into v_shift_id
    from public.shifts sh
    where sh.id = v_sale.shift_id and sh.closed_at is null;
  end if;

  if v_shift_id is null and v_sale.payment_method = 'cash' then
    raise exception 'ต้องเปิดรอบขายก่อนจึงจะคืนเงินสดได้ เพราะเงินที่คืนต้องถูกหักออกจากลิ้นชักของรอบนั้น';
  end if;

  -- -------------------------------------------------------------------
  -- 8. บันทึกใบคืน — คืนด้วยช่องทางเดียวกับที่ลูกค้าจ่ายมา
  -- -------------------------------------------------------------------
  insert into public.returns (
    sale_id, shift_id, staff_id, reason, refund_amount, refund_method, created_at
  )
  values (
    p_sale_id, v_shift_id, v_staff_id, btrim(p_reason), v_refund, v_sale.payment_method, v_now
  )
  returning id into v_return_id;

  -- -------------------------------------------------------------------
  -- 9. เฉลี่ยเงินคืนลงรายการตามสัดส่วน เศษไปรวมที่รายการยอดสูงสุด (§7.5)
  -- -------------------------------------------------------------------
  for i in 1..v_count loop
    if v_share_sum > 0 then
      v_allocs := v_allocs || public.round_half_up(v_refund * v_shares[i] / v_share_sum, 2);
    else
      v_allocs := v_allocs || 0::numeric;
    end if;

    v_alloc_sum := v_alloc_sum + v_allocs[i];

    if v_shares[i] > v_shares[v_max_idx] then
      v_max_idx := i;
    end if;
  end loop;

  v_allocs[v_max_idx] := v_allocs[v_max_idx] + (v_refund - v_alloc_sum);

  -- -------------------------------------------------------------------
  -- 10. บันทึกรายการในใบคืน + คืนของเข้าสต็อกเฉพาะที่ขายต่อได้
  -- -------------------------------------------------------------------
  for i in 1..v_count loop
    insert into public.return_items (return_id, sale_item_id, quantity, restock, refund_amount)
    values (v_return_id, v_ids[i], v_qtys[i], v_restocks[i], v_allocs[i]);

    if v_restocks[i] then
      update public.inventory
      set quantity   = quantity + v_qtys[i],
          updated_at = v_now
      where product_id = v_pids[i];

      insert into public.stock_movements (
        product_id, type, qty_change, ref_table, ref_id, reason, unit_cost, staff_id, created_at
      ) values (
        v_pids[i], 'return', v_qtys[i], 'returns', v_return_id,
        btrim(p_reason), v_costs[i], v_staff_id, v_now
      );
    end if;

    v_result := v_result || jsonb_build_object(
      'sale_item_id',  v_ids[i],
      'product_id',    v_pids[i],
      'name',          v_names[i],
      'quantity',      v_qtys[i],
      'restock',       v_restocks[i],
      'refund_amount', v_allocs[i]
    );
  end loop;

  -- -------------------------------------------------------------------
  -- 11. เปลี่ยนสถานะบิล — ไม่ลบบิล ไม่แก้ยอดเดิมของบิล (§4)
  -- -------------------------------------------------------------------
  update public.sales
  set status = case when v_fully then 'returned' else 'partially_returned' end
  where id = p_sale_id
  returning * into v_sale;

  return jsonb_build_object(
    'return_id',     v_return_id,
    'sale_id',       p_sale_id,
    'shift_id',      v_shift_id,
    'receipt_no',    v_sale.receipt_no,
    'refund_amount', v_refund,
    'refund_method', v_sale.payment_method,
    'sale_status',   v_sale.status,
    'items',         v_result
  );
end;
$$;

-- ---------------------------------------------------------------------
-- void_sale — ยกเลิกบิลทั้งใบ คืนของเข้าสต็อกทุกชิ้น
-- ---------------------------------------------------------------------
create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_now      timestamptz := now();
  v_sale     public.sales;
  v_shift    public.shifts;
  v_reason   text;
begin
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนยกเลิกบิล';
  end if;

  if not public.is_owner() then
    raise exception 'การยกเลิกบิลเป็นสิทธิ์ของเจ้าของร้านเท่านั้น';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ต้องระบุเหตุผลในการยกเลิกบิล';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'ไม่พบบิลที่ระบุ';
  end if;

  if v_sale.status = 'voided' then
    raise exception 'บิล % ถูกยกเลิกไปแล้ว', v_sale.receipt_no;
  end if;

  if v_sale.status <> 'completed'
     or exists (select 1 from public.returns r where r.sale_id = p_sale_id) then
    raise exception 'บิล % มีการคืนสินค้าไปแล้ว ยกเลิกทั้งบิลไม่ได้ ให้คืนส่วนที่เหลือแทน',
      v_sale.receipt_no;
  end if;

  select * into v_shift from public.shifts where id = v_sale.shift_id;
  if found and v_shift.closed_at is not null then
    raise exception 'บิล % อยู่ในรอบขายที่ปิดไปแล้วเมื่อ % ยอดเงินสดของรอบถูกบันทึกไว้แล้ว ให้ใช้การคืนสินค้าแทน',
      v_sale.receipt_no,
      to_char(v_shift.closed_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI');
  end if;

  v_reason := 'ยกเลิกบิล ' || v_sale.receipt_no || ': ' || btrim(p_reason);

  -- คืนของเข้าสต็อกทุกรายการ พร้อมเขียน movement คู่กันในธุรกรรมเดียว (§7.1)
  update public.inventory inv
  set quantity   = inv.quantity + si.quantity,
      updated_at = v_now
  from public.sale_items si
  where si.sale_id = p_sale_id
    and inv.product_id = si.product_id;

  insert into public.stock_movements (
    product_id, type, qty_change, ref_table, ref_id, reason, unit_cost, staff_id, created_at
  )
  select si.product_id, 'return', si.quantity, 'sales', p_sale_id,
         v_reason, si.unit_cost, v_staff_id, v_now
  from public.sale_items si
  where si.sale_id = p_sale_id;

  update public.sales
  set status = 'voided'
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- สิทธิ์การเรียก
-- ---------------------------------------------------------------------
revoke all on function public.create_return(uuid, jsonb, text) from public, anon;
revoke all on function public.void_sale(uuid, text)             from public, anon;
grant execute on function public.create_return(uuid, jsonb, text) to authenticated;
grant execute on function public.void_sale(uuid, text)            to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
declare
  v_missing text := '';
begin
  if to_regprocedure('public.create_return(uuid,jsonb,text)') is null then
    v_missing := v_missing || 'create_return ';
  end if;
  if to_regprocedure('public.void_sale(uuid,text)') is null then
    v_missing := v_missing || 'void_sale ';
  end if;

  if v_missing <> '' then
    raise exception '009_rpc_returns: สร้างฟังก์ชันไม่ครบ: %', v_missing;
  end if;

  raise notice '009_rpc_returns: สร้าง create_return และ void_sale แล้ว';
end $$;
