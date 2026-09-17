-- =====================================================================
-- Aunchan POS — 004_rpc_checkout.sql
-- RPC ปิดบิล: checkout_sale  (§7.2 ทั้งข้อ)
-- concern เดียว: การปิดบิลเป็นธุรกรรมเดียว
-- รันซ้ำได้อย่างปลอดภัย (create or replace)
-- =====================================================================
--
-- checkout_sale
--   input : p_client_uuid      uuid    สร้างจากเบราว์เซอร์ก่อนกดยืนยัน (กันบิลซ้ำ §7.6)
--           p_shift_id         uuid    รอบขายที่เปิดอยู่ของผู้เรียกเอง
--           p_items            jsonb   [{product_id, quantity}] เท่านั้น — ห้ามส่งราคา (§7.3)
--           p_payment_method   text    'cash' | 'promptpay'
--           p_cash_received    numeric บังคับเมื่อจ่ายเงินสด
--           p_manual_discount  numeric owner เท่านั้น (บาท) หักก่อนคิด VAT
--   output: แถวของตาราง sales (1 แถว)
--   error : ยังไม่เข้าสู่ระบบ / บัญชีถูกปิด / ไม่พบรอบขาย / รอบขายปิดแล้ว /
--           ปิดบิลได้เฉพาะรอบขายของตัวเอง / ไม่มีรายการสินค้า / รูปแบบรายการไม่ถูกต้อง /
--           จำนวนต้องมากกว่าศูนย์ / สินค้าไม่พร้อมขาย / สต็อกไม่พอ (ล้มทั้งบิล) /
--           ส่วนลดกดมือเป็นสิทธิ์ของเจ้าของร้าน / ส่วนลดรวมมากกว่ายอดก่อนภาษี /
--           ช่องทางชำระเงินไม่ถูกต้อง / ต้องกรอกเงินที่รับ / เงินที่รับน้อยกว่ายอดสุทธิ
--   สิทธิ์ : owner และ staff (staff ส่ง p_manual_discount > 0 ไม่ได้)
--   ซ้ำ   : ส่ง p_client_uuid เดิม → คืนบิลเดิม ไม่สร้างใหม่ ไม่ใช่ error (§7.6)
--
-- ลำดับภายในฟังก์ชันตาม §7.2 (ห้ามสลับ):
--   ตรวจ shift เปิดอยู่ → SELECT ... FOR UPDATE ทุกแถว inventory → เช็คสต็อกครบทุกรายการ
--   → อ่านราคา/ต้นทุนจาก products → คิดโปรโมชั่นตามลำดับ §4 → คิด VAT
--   → ออกเลขที่บิล → insert sales + sale_items → update inventory + stock_movements
-- =====================================================================

create or replace function public.checkout_sale(
  p_client_uuid uuid,
  p_shift_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_cash_received numeric default null,
  p_manual_discount numeric default 0
)
returns public.sales
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id      uuid := auth.uid();
  v_is_owner      boolean;
  v_now           timestamptz := now();
  v_today         date;
  v_shift         public.shifts;
  v_sale          public.sales;
  v_vat_rate      numeric(4,2);
  v_gross_total   numeric;          -- ยอดเต็มก่อนส่วนลดใด ๆ
  v_subtotal_raw  numeric;          -- ยอดหลังลด % รายสินค้า (ยังไม่ปัด)
  v_subtotal      numeric(10,2);
  v_item_discount numeric(10,2);
  v_bill_promo_id uuid;
  v_bill_discount numeric(10,2);
  v_manual        numeric(10,2);
  v_taxable       numeric(10,2);
  v_vat           numeric(10,2);
  v_total         numeric(10,2);
  v_change        numeric(10,2);
  v_receipt       varchar(20);
  v_residual      numeric(10,2);
  v_lines_sum     numeric(10,2);
  v_bad           text;
begin
  -- -------------------------------------------------------------------
  -- 0. ผู้เรียก
  -- -------------------------------------------------------------------
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนปิดบิล';
  end if;

  if not public.is_active_staff() then
    raise exception 'บัญชีผู้ใช้นี้ถูกปิดการใช้งาน';
  end if;

  v_is_owner := public.is_owner();
  v_today    := (v_now at time zone 'Asia/Bangkok')::date;

  -- -------------------------------------------------------------------
  -- 1. กันบิลซ้ำ (§7.6) — client_uuid เดิม คืนบิลเดิม ไม่ใช่ error
  -- -------------------------------------------------------------------
  if p_client_uuid is null then
    raise exception 'ต้องส่ง client_uuid ทุกครั้งที่ปิดบิล';
  end if;

  select * into v_sale from public.sales where client_uuid = p_client_uuid;
  if found then
    return v_sale;
  end if;

  -- -------------------------------------------------------------------
  -- 2. ตรวจพารามิเตอร์
  -- -------------------------------------------------------------------
  if p_payment_method is null or p_payment_method not in ('cash','promptpay') then
    raise exception 'ช่องทางชำระเงินไม่ถูกต้อง: %', coalesce(p_payment_method, '(ว่าง)');
  end if;

  v_manual := public.round_half_up(coalesce(p_manual_discount, 0), 2);
  if v_manual < 0 then
    raise exception 'ส่วนลดกดมือต้องไม่ติดลบ';
  end if;
  if v_manual > 0 and not v_is_owner then
    raise exception 'ส่วนลดกดมือเป็นสิทธิ์ของเจ้าของร้านเท่านั้น';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'ไม่มีรายการสินค้าในบิล';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where i ->> 'product_id' is null or i ->> 'quantity' is null
  ) then
    raise exception 'รูปแบบรายการสินค้าไม่ถูกต้อง (ต้องมี product_id และ quantity)';
  end if;

  -- -------------------------------------------------------------------
  -- 3. ตรวจรอบขายว่าเปิดอยู่และเป็นของผู้เรียกเอง (§4 รอบขาย)
  -- -------------------------------------------------------------------
  select * into v_shift from public.shifts where id = p_shift_id for update;
  if not found then
    raise exception 'ไม่พบรอบขายที่ระบุ';
  end if;
  if v_shift.staff_id <> v_staff_id then
    raise exception 'ปิดบิลได้เฉพาะรอบขายของตัวเองเท่านั้น';
  end if;
  if v_shift.closed_at is not null then
    raise exception 'รอบขายนี้ปิดไปแล้ว ไม่สามารถปิดบิลได้';
  end if;

  -- -------------------------------------------------------------------
  -- 4. รวมรายการซ้ำเป็นบรรทัดเดียว (ตะกร้าอาจส่ง product เดิมมาหลายครั้ง)
  -- -------------------------------------------------------------------
  drop table if exists pg_temp._cart;
  create temp table _cart (
    product_id      uuid primary key,
    quantity        integer not null,
    unit_price      numeric(10,2),
    unit_cost       numeric(10,2),
    promotion_id    uuid,
    gross           numeric,
    after_item      numeric,
    line_total      numeric(10,2),
    discount_amount numeric(10,2)
  ) on commit drop;

  insert into pg_temp._cart (product_id, quantity)
  select (i ->> 'product_id')::uuid, sum((i ->> 'quantity')::integer)
  from jsonb_array_elements(p_items) i
  group by 1;

  if exists (select 1 from pg_temp._cart where quantity <= 0) then
    raise exception 'จำนวนสินค้าต้องมากกว่าศูนย์';
  end if;

  -- -------------------------------------------------------------------
  -- 5. ล็อกแถว inventory ทุกตัวในบิลก่อนเช็คสต็อก (§7.2)
  --    เรียงตาม product_id เพื่อกัน deadlock เมื่อสองบิลมีสินค้าชุดเดียวกัน
  -- -------------------------------------------------------------------
  perform 1
  from public.inventory inv
  where inv.product_id in (select c.product_id from pg_temp._cart c)
  order by inv.product_id
  for update;

  -- -------------------------------------------------------------------
  -- 6. สินค้าต้องมีจริงและเปิดขายอยู่
  -- -------------------------------------------------------------------
  select string_agg(coalesce(p.name, c.product_id::text), ', ')
    into v_bad
  from pg_temp._cart c
  left join public.products p on p.id = c.product_id
  where p.id is null or not p.is_active;

  if v_bad is not null then
    raise exception 'สินค้าไม่พร้อมขาย: %', v_bad;
  end if;

  -- -------------------------------------------------------------------
  -- 7. เช็คสต็อกทุกรายการ — ไม่พอแม้รายการเดียว ล้มทั้งบิล (§4 ห้ามทำ ข้อ 1)
  -- -------------------------------------------------------------------
  select string_agg(
           format('%s (คงเหลือ %s ต้องการ %s)', p.name, coalesce(inv.quantity, 0), c.quantity),
           ', ')
    into v_bad
  from pg_temp._cart c
  join public.products p on p.id = c.product_id
  left join public.inventory inv on inv.product_id = c.product_id
  where coalesce(inv.quantity, 0) < c.quantity;

  if v_bad is not null then
    raise exception 'สต็อกไม่พอ: %', v_bad;
  end if;

  -- -------------------------------------------------------------------
  -- 8. อ่านราคาและต้นทุนจากฐานข้อมูล — ไม่รับตัวเลขจากเบราว์เซอร์ (§7.3)
  -- -------------------------------------------------------------------
  update pg_temp._cart c
  set unit_price = p.price,
      unit_cost  = p.cost_price,
      gross      = p.price * c.quantity
  from public.products p
  where p.id = c.product_id;

  -- -------------------------------------------------------------------
  -- 9. โปรโมชั่นลด % รายสินค้า — เข้าเกณฑ์หลายตัวให้ตัวที่ลดมากที่สุดชนะ
  -- -------------------------------------------------------------------
  update pg_temp._cart c
  set promotion_id = b.promo_id,
      after_item   = c.gross - (c.gross * b.discount_value / 100)
  from (
    select distinct on (pr.product_id)
           pr.product_id, pr.id as promo_id, pr.discount_value
    from public.promotions pr
    where pr.scope = 'item'
      and pr.is_active
      and v_today between pr.start_date and pr.end_date
    order by pr.product_id, pr.discount_value desc, pr.created_at desc
  ) b
  where b.product_id = c.product_id;

  update pg_temp._cart set after_item = gross where after_item is null;

  -- -------------------------------------------------------------------
  -- 10. รวมเป็นยอดก่อนภาษี (§4 ลำดับโปรโมชั่น ขั้นที่ 2)
  -- -------------------------------------------------------------------
  select coalesce(sum(gross), 0), coalesce(sum(after_item), 0)
    into v_gross_total, v_subtotal_raw
  from pg_temp._cart;

  v_subtotal      := public.round_half_up(v_subtotal_raw, 2);
  v_item_discount := public.round_half_up(v_gross_total, 2) - v_subtotal;

  -- -------------------------------------------------------------------
  -- 11. เช็คเกณฑ์ "ซื้อครบ N" จากยอดหลังส่วนลดรายสินค้า (§4 ขั้นที่ 3)
  --     เข้าเกณฑ์หลายตัวให้ตัวที่ลดมากที่สุดชนะ
  -- -------------------------------------------------------------------
  v_bill_discount := 0;

  select pr.id, pr.discount_value
    into v_bill_promo_id, v_bill_discount
  from public.promotions pr
  where pr.scope = 'bill'
    and pr.is_active
    and v_today between pr.start_date and pr.end_date
    and v_subtotal >= pr.min_amount
  order by pr.discount_value desc, pr.created_at desc
  limit 1;

  v_bill_discount := coalesce(v_bill_discount, 0);

  -- -------------------------------------------------------------------
  -- 12. หักส่วนลดระดับบิล + ส่วนลดกดมือ แล้วคิด VAT (§4 ขั้นที่ 4-5, §7.5)
  -- -------------------------------------------------------------------
  select vat_rate into v_vat_rate from public.store_settings where id = 1;
  v_vat_rate := coalesce(v_vat_rate, 7.00);

  v_taxable := v_subtotal - v_bill_discount - v_manual;
  if v_taxable < 0 then
    raise exception 'ส่วนลดรวม % บาท มากกว่ายอดก่อนภาษี % บาท',
      v_bill_discount + v_manual, v_subtotal;
  end if;

  v_vat   := public.round_half_up(v_taxable * v_vat_rate / 100, 2);
  v_total := v_taxable + v_vat;

  -- -------------------------------------------------------------------
  -- 13. เงินสด: ตรวจเงินที่รับและคำนวณเงินทอนฝั่งเซิร์ฟเวอร์
  -- -------------------------------------------------------------------
  if p_payment_method = 'cash' then
    if p_cash_received is null then
      raise exception 'ต้องกรอกจำนวนเงินที่รับมาเมื่อชำระด้วยเงินสด';
    end if;
    if p_cash_received < v_total then
      raise exception 'เงินที่รับ % บาท น้อยกว่ายอดสุทธิ % บาท', p_cash_received, v_total;
    end if;
    v_change := public.round_half_up(p_cash_received - v_total, 2);
  end if;

  -- -------------------------------------------------------------------
  -- 14. ออกเลขที่บิลและบันทึกบิล
  -- -------------------------------------------------------------------
  v_receipt := public.next_receipt_no(v_now);

  insert into public.sales (
    receipt_no, staff_id, shift_id, status,
    subtotal, item_discount, bill_discount, manual_discount,
    vat_rate, vat_amount, total_amount,
    payment_method, cash_received, cash_change, payment_confirmed_by,
    client_uuid, created_at
  ) values (
    v_receipt, v_staff_id, v_shift.id, 'completed',
    v_subtotal, v_item_discount, v_bill_discount, v_manual,
    v_vat_rate, v_vat, v_total,
    p_payment_method,
    case when p_payment_method = 'cash' then public.round_half_up(p_cash_received, 2) end,
    case when p_payment_method = 'cash' then v_change end,
    case when p_payment_method = 'promptpay' then v_staff_id end,
    p_client_uuid, v_now
  )
  returning * into v_sale;

  -- -------------------------------------------------------------------
  -- 15. เฉลี่ยส่วนลดระดับบิลลงรายการตามสัดส่วน เศษไปรวมที่รายการยอดสูงสุด (§7.5)
  --     ผลรวม line_total_excl_vat ต้องเท่ากับ subtotal - bill_discount เป๊ะ
  -- -------------------------------------------------------------------
  -- หมายเหตุ: ทุก UPDATE ในฟังก์ชันนี้ต้องมี WHERE เสมอ แม้จะตั้งใจอัปเดตทุกแถว
  -- เพราะ Supabase เปิดส่วนขยาย safeupdate ให้ role authenticated
  -- ซึ่งปฏิเสธ UPDATE ที่ไม่มี WHERE ด้วยข้อความ "UPDATE requires a WHERE clause"
  update pg_temp._cart c
  set line_total = public.round_half_up(
        c.after_item
        - case when v_subtotal_raw > 0 then v_bill_discount * c.after_item / v_subtotal_raw else 0 end,
        2)
  where c.product_id is not null;

  select (v_subtotal - v_bill_discount) - coalesce(sum(line_total), 0)
    into v_residual
  from pg_temp._cart;

  if v_residual <> 0 then
    update pg_temp._cart
    set line_total = line_total + v_residual
    where product_id = (
      select product_id from pg_temp._cart order by line_total desc, product_id limit 1
    );
  end if;

  update pg_temp._cart
  set discount_amount = public.round_half_up(gross, 2) - line_total
  where product_id is not null;

  insert into public.sale_items (
    sale_id, product_id, quantity, unit_price, unit_cost,
    promotion_id, discount_amount, line_total_excl_vat, created_at
  )
  select v_sale.id, c.product_id, c.quantity, c.unit_price, c.unit_cost,
         c.promotion_id, c.discount_amount, c.line_total, v_now
  from pg_temp._cart c;

  -- -------------------------------------------------------------------
  -- 16. ตัดสต็อก + เขียน movement คู่กันในธุรกรรมเดียว (§7.1)
  -- -------------------------------------------------------------------
  update public.inventory inv
  set quantity = inv.quantity - c.quantity,
      updated_at = v_now
  from pg_temp._cart c
  where inv.product_id = c.product_id;

  insert into public.stock_movements (
    product_id, type, qty_change, ref_table, ref_id, staff_id, created_at
  )
  select c.product_id, 'sale', -c.quantity, 'sales', v_sale.id, v_staff_id, v_now
  from pg_temp._cart c;

  -- -------------------------------------------------------------------
  -- 17. ยืนยันความถูกต้องของตัวเลขก่อน commit
  -- -------------------------------------------------------------------
  select coalesce(sum(line_total_excl_vat), 0)
    into v_lines_sum
  from public.sale_items
  where sale_id = v_sale.id;

  if v_lines_sum <> v_subtotal - v_bill_discount then
    raise exception 'ผลรวมรายการ % ไม่เท่ากับยอดก่อนภาษีหลังหักส่วนลดบิล %',
      v_lines_sum, v_subtotal - v_bill_discount;
  end if;

  if v_sale.total_amount <> v_sale.subtotal - v_sale.bill_discount - v_sale.manual_discount + v_sale.vat_amount then
    raise exception 'ยอดสุทธิของบิลไม่ตรงกับสูตร subtotal - ส่วนลด + VAT';
  end if;

  return v_sale;

exception
  -- ยิงพร้อมกันด้วย client_uuid เดิม: อีกธุรกรรมชนะไปแล้ว ให้คืนบิลเดิม (§7.6)
  when unique_violation then
    select * into v_sale from public.sales where client_uuid = p_client_uuid;
    if found then
      return v_sale;
    end if;
    raise;
end;
$$;

revoke all on function public.checkout_sale(uuid, uuid, jsonb, text, numeric, numeric) from public, anon;
grant execute on function public.checkout_sale(uuid, uuid, jsonb, text, numeric, numeric) to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
begin
  if to_regprocedure('public.checkout_sale(uuid,uuid,jsonb,text,numeric,numeric)') is null then
    raise exception '004_rpc_checkout: ไม่พบฟังก์ชัน checkout_sale';
  end if;
  raise notice '004_rpc_checkout: สร้างฟังก์ชัน checkout_sale แล้ว';
end $$;
