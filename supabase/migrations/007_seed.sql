-- =====================================================================
-- Aunchan POS — 007_seed.sql
-- ข้อมูลตัวอย่างตาม §9 + query ตรวจสอบ inventory.quantity = SUM(stock_movements)
-- concern เดียว: ข้อมูลตั้งต้น
-- รันซ้ำได้อย่างปลอดภัย (ทุกส่วนมี guard ไม่สร้างซ้ำ)
-- =====================================================================
-- บัญชีทดสอบ (ตกลงกับเจ้าของโปรเจกต์แล้วว่า seed ลง auth.users โดยตรง):
--   owner@aunchan.local / Aunchan123!
--   staff@aunchan.local / Aunchan123!
--
-- วิธีรัน: เปิด Supabase SQL Editor → วางทั้งไฟล์ → Ctrl+A ให้แน่ใจว่าเลือกครบ → Run
--
-- ไฟล์นี้จงใจเขียนเป็นบล็อก do $$ ... $$ บล็อกเดียว (1 คำสั่ง)
-- เพราะ SQL Editor ของ Supabase รันแต่ละคำสั่งแยกกัน ตารางชั่วคราวหรือ
-- ตารางช่วยที่สร้างในคำสั่งหนึ่งจะมองไม่เห็นในคำสั่งถัดไป
-- ทุกอย่างจึงอยู่ในบล็อกเดียว ไม่มีการอ้างถึงวัตถุที่สร้างในคำสั่งก่อนหน้า
-- =====================================================================

do $$
declare
  v_owner_id uuid := '11111111-1111-4111-8111-111111111111';
  v_staff_id uuid := '22222222-2222-4222-8222-222222222222';
  v_pwd      text := 'Aunchan123!';

  r          record;
  v_pid      uuid;
  v_vat_rate numeric(4,2);

  -- ตัวแปรของบิลย้อนหลัง
  v_bills_by_day integer[] := array[4,4,4,4,5,5,4];   -- รวม 30 บิล
  -- สินค้าที่ใช้ในบิลย้อนหลัง: ตัด P004, P011, P017 ออก เพราะตั้งใจให้ค้างอยู่ที่จุดสั่งซื้อ
  v_skus     text[] := array['P001','P002','P003','P005','P006','P007','P008','P009','P010',
                             'P012','P013','P014','P015','P016','P018','P019','P020'];
  v_day      integer;
  v_bill     integer;
  v_line     integer;
  v_i        integer;
  v_counter  integer := 0;
  v_actor    uuid;
  v_shift_id uuid;
  v_opened   timestamptz;
  v_created  timestamptz;
  v_sale_id  uuid;
  v_subtotal numeric(10,2);
  v_vat      numeric(10,2);
  v_total    numeric(10,2);
  v_method   text;
  v_received numeric(10,2);
  v_cash_in  numeric(10,2);
  v_diff     numeric(10,2);
  v_prod     record;
  -- รายการในบิลเก็บเป็น array แทนตารางชั่วคราว
  v_pids     uuid[];
  v_qtys     integer[];
  v_prices   numeric[];
  v_costs    numeric[];
begin
  -- pgcrypto อยู่ schema extensions บน Supabase (บางโปรเจกต์อยู่ public)
  -- ตั้ง search_path เฉพาะบล็อกนี้ ให้ crypt()/gen_salt() หาเจอทั้งสองแบบ
  perform set_config('search_path', 'public, extensions', true);

  -- ===================================================================
  -- 1. store_settings — 1 แถวเท่านั้น
  -- ===================================================================
  insert into public.store_settings (
    id, shop_name, address, tax_id, is_vat_registered, vat_rate,
    promptpay_id, receipt_prefix, receipt_reset_yearly
  ) values (
    1, 'Aunchan', '123/45 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400',
    -- promptpay_id เป็นเบอร์สมมติโดยตั้งใจ ห้ามใส่เบอร์จริงลงไฟล์ที่ขึ้น git
    -- ตั้งค่าเบอร์จริงหลัง seed ด้วย:
    --   update public.store_settings set promptpay_id = '08XXXXXXXX' where id = 1;
    '0105561234567', true, 7.00, '0812345678', 'INV', true
  )
  on conflict (id) do nothing;

  -- ===================================================================
  -- 2. ผู้ใช้ 2 คนใน Supabase Auth + แถวในตาราง staff
  -- ===================================================================
  if not exists (select 1 from auth.users where id = v_owner_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_owner_id, 'authenticated', 'authenticated',
      'owner@aunchan.local', crypt(v_pwd, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"เจ้าของร้าน Aunchan"}'::jsonb, now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_owner_id, v_owner_id::text,
      jsonb_build_object('sub', v_owner_id::text, 'email', 'owner@aunchan.local', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  if not exists (select 1 from auth.users where id = v_staff_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_staff_id, 'authenticated', 'authenticated',
      'staff@aunchan.local', crypt(v_pwd, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"พนักงานขาย"}'::jsonb, now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_staff_id, v_staff_id::text,
      jsonb_build_object('sub', v_staff_id::text, 'email', 'staff@aunchan.local', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.staff (id, name, role, email, is_active) values
    (v_owner_id, 'เจ้าของร้าน Aunchan', 'owner', 'owner@aunchan.local', true),
    (v_staff_id, 'พนักงานขาย',          'staff', 'staff@aunchan.local', true)
  on conflict (id) do nothing;

  -- ===================================================================
  -- 3. ซัพพลายเออร์ 3 ราย
  -- ===================================================================
  insert into public.suppliers (id, name, contact, email, note) values
    ('aaaaaaaa-0000-4000-8000-000000000001', 'บจก. เครื่องเขียนไทยรุ่งเรือง', '02-111-2233', 'sales@thairung.co.th', 'ส่งของทุกวันอังคาร'),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'หจก. กระดาษสยามเปเปอร์',       '02-444-5566', 'order@siampaper.co.th', 'ขั้นต่ำ 5,000 บาทต่อบิล'),
    ('aaaaaaaa-0000-4000-8000-000000000003', 'ร้านอุปกรณ์สำนักงานพาณิชย์',    '081-777-8899', 'contact@officepanit.com', 'รับของเองที่ร้าน')
  on conflict (id) do nothing;

  -- ===================================================================
  -- 4. สินค้า 20 รายการใน 3 หมวด + สต็อกตั้งต้น
  --    P004, P011, P017 ตั้งให้ "ถึงจุดสั่งซื้อ" (quantity <= reorder_point)
  --    ทุกตัวเขียน stock_movements คู่กับสต็อกเสมอ (§7.1)
  -- ===================================================================
  for r in
    select * from (values
      -- หมวดเครื่องเขียน
      ('P001','ปากกาลูกลื่น 0.5 มม. น้ำเงิน','เครื่องเขียน','ด้าม',  4.50,  8.00,'8851234500011','aaaaaaaa-0000-4000-8000-000000000001'::uuid,180, 20),
      ('P002','ปากกาลูกลื่น 0.5 มม. แดง',    'เครื่องเขียน','ด้าม',  4.50,  8.00,'8851234500028','aaaaaaaa-0000-4000-8000-000000000001'::uuid,120, 20),
      ('P003','ปากกาเจล 0.38 มม. ดำ',        'เครื่องเขียน','ด้าม', 12.00, 20.00,'8851234500035','aaaaaaaa-0000-4000-8000-000000000001'::uuid, 90, 15),
      ('P004','ปากกาไฮไลท์ สีเหลือง',        'เครื่องเขียน','ด้าม', 11.00, 18.00,'8851234500042','aaaaaaaa-0000-4000-8000-000000000001'::uuid, 12, 15),
      ('P005','ดินสอไม้ 2B',                 'เครื่องเขียน','แท่ง',  3.00,  6.00,'8851234500059','aaaaaaaa-0000-4000-8000-000000000001'::uuid,200, 25),
      ('P006','ยางลบก้อน ขาว',               'เครื่องเขียน','ก้อน',  3.50,  7.00,'8851234500066','aaaaaaaa-0000-4000-8000-000000000001'::uuid,150, 20),
      ('P007','ปากกาเมจิก 12 สี',            'เครื่องเขียน','ชุด',  55.00, 95.00,'8851234500073','aaaaaaaa-0000-4000-8000-000000000001'::uuid, 40, 10),
      ('P008','น้ำยาลบคำผิด แบบลูกลื่น',      'เครื่องเขียน','ด้าม', 18.00, 30.00,'8851234500080','aaaaaaaa-0000-4000-8000-000000000001'::uuid, 60, 12),
      -- หมวดกระดาษ
      ('P009','กระดาษถ่ายเอกสาร A4 80 แกรม', 'กระดาษ','รีม',  98.00,135.00,'8852345600017','aaaaaaaa-0000-4000-8000-000000000002'::uuid,100, 15),
      ('P010','กระดาษถ่ายเอกสาร A4 70 แกรม', 'กระดาษ','รีม',  88.00,120.00,'8852345600024','aaaaaaaa-0000-4000-8000-000000000002'::uuid, 80, 15),
      ('P011','กระดาษสี A4 คละสี 100 แผ่น',   'กระดาษ','แพ็ค', 45.00, 75.00,'8852345600031','aaaaaaaa-0000-4000-8000-000000000002'::uuid,  8, 12),
      ('P012','สมุดโน้ตปกอ่อน A5',           'กระดาษ','เล่ม', 16.00, 28.00,'8852345600048','aaaaaaaa-0000-4000-8000-000000000002'::uuid,110, 20),
      ('P013','สมุดริมลวด A4 70 แผ่น',        'กระดาษ','เล่ม', 28.00, 48.00,'8852345600055','aaaaaaaa-0000-4000-8000-000000000002'::uuid, 70, 15),
      ('P014','กระดาษโน้ตกาว 3x3 นิ้ว',       'กระดาษ','แพ็ค', 20.00, 35.00,'8852345600062','aaaaaaaa-0000-4000-8000-000000000002'::uuid, 95, 18),
      ('P015','การ์ดอวยพร พร้อมซอง',          'กระดาษ','ใบ',  12.00, 25.00,'8852345600079','aaaaaaaa-0000-4000-8000-000000000002'::uuid, 55, 10),
      -- หมวดอุปกรณ์
      ('P016','กรรไกร 8 นิ้ว ด้ามยาง',        'อุปกรณ์','อัน',  42.00, 72.00,'8853456700013','aaaaaaaa-0000-4000-8000-000000000003'::uuid, 45, 10),
      ('P017','เทปใส 1 นิ้ว แกนใหญ่',         'อุปกรณ์','ม้วน', 15.00, 26.00,'8853456700020','aaaaaaaa-0000-4000-8000-000000000003'::uuid, 10, 14),
      ('P018','กาวแท่ง 21 กรัม',              'อุปกรณ์','แท่ง', 17.00, 29.00,'8853456700037','aaaaaaaa-0000-4000-8000-000000000003'::uuid, 65, 12),
      ('P019','ที่เย็บกระดาษ เบอร์ 10',        'อุปกรณ์','อัน',  58.00, 98.00,'8853456700044','aaaaaaaa-0000-4000-8000-000000000003'::uuid, 35, 8),
      ('P020','ลวดเย็บกระดาษ เบอร์ 10',        'อุปกรณ์','กล่อง', 6.00, 12.00,'8853456700051','aaaaaaaa-0000-4000-8000-000000000003'::uuid,140, 20)
    ) as t(sku, name, category, unit, cost_price, price, barcode, supplier_id, init_qty, reorder_point)
  loop
    insert into public.products (supplier_id, name, sku, category, unit, cost_price, price,
                                 barcode, is_vat_exempt, is_active)
    values (r.supplier_id, r.name, r.sku, r.category, r.unit, r.cost_price, r.price,
            r.barcode, false, true)
    on conflict (sku) do nothing;

    select id into v_pid from public.products where sku = r.sku;

    insert into public.inventory (product_id, quantity, reorder_point)
    values (v_pid, 0, r.reorder_point)
    on conflict (product_id) do update set reorder_point = excluded.reorder_point;

    if not exists (select 1 from public.stock_movements m where m.product_id = v_pid) then
      insert into public.stock_movements (product_id, type, qty_change, reason, unit_cost,
                                          staff_id, created_at)
      values (v_pid, 'receive', r.init_qty, 'รับสินค้าเข้าตั้งต้น (ข้อมูลตัวอย่าง)',
              r.cost_price, v_owner_id, now() - interval '8 days');
    end if;
  end loop;

  -- ===================================================================
  -- 5. โปรโมชั่น 2 รายการตาม §9 (เริ่มมีผลวันนี้ บิลย้อนหลังจึงไม่ถูกกระทบ)
  -- ===================================================================
  if not exists (select 1 from public.promotions where name = 'ลด 10% ปากกาเจล 0.38 มม. ดำ') then
    select id into v_pid from public.products where sku = 'P003';
    insert into public.promotions (name, scope, product_id, min_amount, discount_type,
                                   discount_value, start_date, end_date, is_active)
    values ('ลด 10% ปากกาเจล 0.38 มม. ดำ', 'item', v_pid, null, 'percentage', 10.00,
            current_date, current_date + 60, true);
  end if;

  if not exists (select 1 from public.promotions where name = 'ซื้อครบ 300 ลด 30') then
    insert into public.promotions (name, scope, product_id, min_amount, discount_type,
                                   discount_value, start_date, end_date, is_active)
    values ('ซื้อครบ 300 ลด 30', 'bill', null, 300.00, 'fixed_amount', 30.00,
            current_date, current_date + 60, true);
  end if;

  -- ===================================================================
  -- 6. บิลย้อนหลัง 7 วัน รวม 30 บิล (สำหรับ Dashboard และรายงาน)
  --    ไม่เรียก checkout_sale เพราะต้องย้อนวันที่ แต่ใช้สูตรเดียวกันทุกขั้น
  --    และเขียน stock_movements คู่กับทุกบิลเหมือน RPC จริง
  -- ===================================================================
  if exists (select 1 from public.sales) then
    raise notice '007_seed: มีบิลอยู่ในระบบแล้ว ข้ามการสร้างบิลย้อนหลัง';
  else
    select vat_rate into v_vat_rate from public.store_settings where id = 1;

    for v_day in 1..7 loop
      v_actor  := case when v_day % 2 = 0 then v_owner_id else v_staff_id end;
      v_opened := date_trunc('day', now() - make_interval(days => 8 - v_day)) + interval '9 hours';

      insert into public.shifts (staff_id, opened_at, opening_cash, created_at)
      values (v_actor, v_opened, 1000.00, v_opened)
      returning id into v_shift_id;

      for v_bill in 1..v_bills_by_day[v_day] loop
        v_counter := v_counter + 1;
        v_pids   := array[]::uuid[];
        v_qtys   := array[]::integer[];
        v_prices := array[]::numeric[];
        v_costs  := array[]::numeric[];

        -- 1-3 รายการต่อบิล เลือกสินค้าแบบกำหนดค่าตายตัวเพื่อให้ผลลัพธ์ทำซ้ำได้
        for v_line in 0 .. (v_counter % 3) loop
          select p.id, p.price, p.cost_price
            into v_prod
          from public.products p
          where p.sku = v_skus[((v_counter * 3 + v_line * 7) % array_length(v_skus, 1)) + 1];

          if v_prod.id is not null and not (v_prod.id = any(v_pids)) then
            v_pids   := v_pids   || v_prod.id;
            v_qtys   := v_qtys   || (1 + ((v_counter + v_line) % 3));
            v_prices := v_prices || v_prod.price;
            v_costs  := v_costs  || v_prod.cost_price;
          end if;
        end loop;

        v_subtotal := 0;
        for v_i in 1 .. array_length(v_pids, 1) loop
          v_subtotal := v_subtotal + (v_prices[v_i] * v_qtys[v_i]);
        end loop;

        v_vat      := public.round_half_up(v_subtotal * v_vat_rate / 100, 2);
        v_total    := v_subtotal + v_vat;
        v_method   := case when v_counter % 3 = 0 then 'promptpay' else 'cash' end;
        v_received := case when v_method = 'cash' then ceil(v_total / 20) * 20 else null end;
        v_created  := v_opened + make_interval(mins => 35 + v_bill * 73);

        insert into public.sales (
          receipt_no, staff_id, shift_id, status,
          subtotal, item_discount, bill_discount, manual_discount,
          vat_rate, vat_amount, total_amount,
          payment_method, cash_received, cash_change, payment_confirmed_by,
          client_uuid, created_at
        ) values (
          public.next_receipt_no(v_created), v_actor, v_shift_id, 'completed',
          v_subtotal, 0, 0, 0,
          v_vat_rate, v_vat, v_total,
          v_method, v_received,
          case when v_method = 'cash' then v_received - v_total end,
          case when v_method = 'promptpay' then v_actor end,
          gen_random_uuid(), v_created
        )
        returning id into v_sale_id;

        for v_i in 1 .. array_length(v_pids, 1) loop
          insert into public.sale_items (
            sale_id, product_id, quantity, unit_price, unit_cost,
            promotion_id, discount_amount, line_total_excl_vat, created_at
          ) values (
            v_sale_id, v_pids[v_i], v_qtys[v_i], v_prices[v_i], v_costs[v_i],
            null, 0, v_prices[v_i] * v_qtys[v_i], v_created
          );

          insert into public.stock_movements (
            product_id, type, qty_change, ref_table, ref_id, staff_id, created_at
          ) values (
            v_pids[v_i], 'sale', -v_qtys[v_i], 'sales', v_sale_id, v_actor, v_created
          );
        end loop;
      end loop;

      -- ปิดรอบขายของวันนั้น (วันที่ 3 จงใจให้เงินขาด 20 บาทเพื่อให้เห็นผลต่าง)
      select coalesce(sum(total_amount), 0)
        into v_cash_in
      from public.sales
      where shift_id = v_shift_id and payment_method = 'cash' and status <> 'voided';

      v_diff := case when v_day = 3 then -20.00 else 0.00 end;

      update public.shifts
      set closed_at     = v_opened + interval '9 hours',
          expected_cash = 1000.00 + v_cash_in,
          counted_cash  = 1000.00 + v_cash_in + v_diff,
          cash_diff     = v_diff
      where id = v_shift_id;
    end loop;

    raise notice '007_seed: สร้างบิลย้อนหลัง % ใบ ใน 7 รอบขาย', v_counter;
  end if;

  -- ===================================================================
  -- 7. ปรับ inventory.quantity ให้เท่ากับผลรวม stock_movements (§7.1)
  --    ทำครั้งเดียวตอน seed เท่านั้น — หลังจากนี้ทุกการเปลี่ยนสต็อกต้องผ่าน RPC
  -- ===================================================================
  update public.inventory inv
  set quantity   = m.total,
      updated_at = now()
  from (
    select product_id, sum(qty_change)::integer as total
    from public.stock_movements
    group by product_id
  ) m
  where m.product_id = inv.product_id
    and inv.quantity <> m.total;

  -- ===================================================================
  -- 8. ตรวจสอบตัวเอง — เกณฑ์ §10 ข้อ 8
  -- ===================================================================
  if exists (
    select 1
    from public.inventory inv
    left join (
      select product_id, sum(qty_change)::integer as total
      from public.stock_movements group by product_id
    ) m on m.product_id = inv.product_id
    where inv.quantity <> coalesce(m.total, 0)
  ) then
    raise exception '007_seed: สต็อกไม่ตรงกับรายการเคลื่อนไหว';
  end if;

  raise notice '007_seed: ข้อมูลตัวอย่างครบและสต็อกตรงกับรายการเคลื่อนไหวทุกสินค้า';
end $$;

-- =====================================================================
-- query ตรวจสอบที่รันซ้ำได้ทุกเมื่อ (คาดหวัง: 0 แถว)
-- คำสั่งนี้อ่านอย่างเดียวและไม่พึ่งวัตถุใด ๆ ที่สร้างในไฟล์นี้
-- ถ้า editor รันได้ทีละคำสั่ง ให้เลือกเฉพาะบล็อกนี้แล้ว Run ซ้ำได้
-- =====================================================================
select p.sku,
       p.name,
       inv.quantity                    as inventory_quantity,
       coalesce(sum(sm.qty_change), 0) as movement_sum
from public.products p
join public.inventory inv on inv.product_id = p.id
left join public.stock_movements sm on sm.product_id = p.id
group by p.sku, p.name, inv.quantity
having inv.quantity <> coalesce(sum(sm.qty_change), 0)
order by p.sku;
