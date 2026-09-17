-- =====================================================================
-- Aunchan POS — 001_tables.sql
-- ตาราง + constraint + index ทั้งหมดตาม AUNCHAN-SPEC.md §6
-- concern เดียว: โครงสร้างตาราง (RLS อยู่ 002, trigger อยู่ 003)
-- รันซ้ำได้อย่างปลอดภัย (idempotent)
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- ตรวจก่อนสร้าง: ถ้ามีตารางชื่อเดียวกันอยู่แล้วแต่โครงสร้างไม่ตรงกับ §6
-- ให้หยุดทันทีพร้อมบอกว่าตารางไหนขาดคอลัมน์อะไร
-- (ไม่เช่นนั้น create table if not exists จะข้ามไปเงียบ ๆ
--  แล้วไปพังที่ alter table ทีหลังด้วยข้อความที่อ่านไม่รู้เรื่อง)
-- แก้โดยรัน supabase/migrations/000_reset.sql ก่อน ถ้าตารางเดิมไม่มีข้อมูลที่ต้องเก็บ
-- ---------------------------------------------------------------------
do $$
declare
  r         record;
  v_missing text;
  v_problem text := '';
begin
  for r in
    select * from (values
      ('staff',           'id,name,role,email,is_active'),
      ('suppliers',       'id,name,contact,email,note,is_active'),
      ('products',        'id,supplier_id,name,sku,category,unit,cost_price,price,is_vat_exempt,barcode,is_active'),
      ('inventory',       'product_id,quantity,reorder_point'),
      ('stock_movements', 'id,product_id,type,qty_change,ref_table,ref_id,reason,unit_cost,staff_id'),
      ('shifts',          'id,staff_id,opened_at,closed_at,opening_cash,expected_cash,counted_cash,cash_diff'),
      ('promotions',      'id,name,scope,product_id,min_amount,discount_type,discount_value,start_date,end_date,is_active'),
      ('sales',           'id,receipt_no,staff_id,shift_id,status,subtotal,item_discount,bill_discount,manual_discount,vat_rate,vat_amount,total_amount,payment_method,cash_received,cash_change,payment_confirmed_by,client_uuid'),
      ('sale_items',      'id,sale_id,product_id,quantity,unit_price,unit_cost,promotion_id,discount_amount,line_total_excl_vat,returned_qty'),
      ('returns',         'id,sale_id,staff_id,reason,refund_amount,refund_method'),
      ('return_items',    'id,return_id,sale_item_id,quantity,restock,refund_amount'),
      ('store_settings',  'id,shop_name,address,tax_id,is_vat_registered,vat_rate,promptpay_id,receipt_prefix,receipt_reset_yearly'),
      ('audit_log',       'id,table_name,record_id,action,changed_by,old_data,new_data')
    ) as t(tbl, cols)
  loop
    if to_regclass('public.' || r.tbl) is not null then
      select string_agg(c, ', ')
        into v_missing
      from unnest(string_to_array(r.cols, ',')) c
      where not exists (
        select 1 from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name   = r.tbl
          and ic.column_name  = c
      );

      if v_missing is not null then
        v_problem := v_problem || format('%s (ขาดคอลัมน์: %s) · ', r.tbl, v_missing);
      end if;
    end if;
  end loop;

  if v_problem <> '' then
    raise exception E'พบตารางเดิมในฐานข้อมูลที่โครงสร้างไม่ตรงกับ AUNCHAN-SPEC §6:\n  %\n'
      'ตารางเหล่านี้เป็นของระบบเดิม ไม่ใช่ของ Aunchan\n'
      'ถ้าไม่มีข้อมูลที่ต้องเก็บ ให้รัน supabase/migrations/000_reset.sql ก่อน แล้วค่อยรัน 001 ใหม่',
      v_problem;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- staff — 1 แถวต่อ 1 auth user
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete restrict,
  name varchar(100) not null,
  role varchar(20) not null check (role in ('owner','staff')),
  email varchar(100) not null unique,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  contact varchar(50),
  email varchar(100),
  note varchar(255),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- products — price = ราคาขายยังไม่รวม VAT, cost_price = ถัวเฉลี่ยถ่วงน้ำหนัก
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  name varchar(100) not null,
  sku varchar(20) not null unique,
  category varchar(50) not null,
  unit varchar(20) not null,
  cost_price numeric(10,2) not null default 0,
  price numeric(10,2) not null,
  is_vat_exempt boolean not null default false,
  image_url varchar(255),
  barcode varchar(30) unique,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- inventory — quantity ติดลบไม่ได้ (§4 ห้ามขายเกินสต็อก)
-- ---------------------------------------------------------------------
create table if not exists public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_point integer not null default 5,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- stock_movements — แหล่งความจริงของสต็อก (§7.1)
-- inventory.quantity ต้องเท่ากับ SUM(qty_change) ของสินค้านั้นเสมอ
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  type varchar(20) not null check (type in ('sale','receive','adjust','waste','return')),
  qty_change integer not null,
  ref_table varchar(20),
  ref_id uuid,
  reason varchar(255),
  unit_cost numeric(10,2),
  staff_id uuid not null references public.staff(id),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- shifts — รอบขาย
-- ---------------------------------------------------------------------
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(10,2) not null default 0,
  expected_cash numeric(10,2),
  counted_cash numeric(10,2),
  cash_diff numeric(10,2),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- promotions — 2 แบบเท่านั้นตาม §4
--   scope = 'item' → ลด % ต่อสินค้า
--   scope = 'bill' → ซื้อครบ N บาท ลด M บาท
-- ---------------------------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  scope varchar(10) not null check (scope in ('item','bill')),
  product_id uuid references public.products(id),
  min_amount numeric(10,2),
  discount_type varchar(20) not null check (discount_type in ('percentage','fixed_amount')),
  discount_value numeric(10,2) not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check ((scope = 'item' and product_id is not null)
      or (scope = 'bill' and min_amount is not null))
);

-- บังคับชนิดส่วนลดให้ตรงกับ §4 (ตกลงกับเจ้าของโปรเจกต์แล้ว)
alter table public.promotions drop constraint if exists promotions_scope_discount_type_chk;
alter table public.promotions add constraint promotions_scope_discount_type_chk
  check ((scope = 'item' and discount_type = 'percentage')
      or (scope = 'bill' and discount_type = 'fixed_amount'));

alter table public.promotions drop constraint if exists promotions_discount_value_chk;
alter table public.promotions add constraint promotions_discount_value_chk
  check (discount_value > 0
     and (scope <> 'item' or discount_value <= 100));

alter table public.promotions drop constraint if exists promotions_date_range_chk;
alter table public.promotions add constraint promotions_date_range_chk
  check (end_date >= start_date);

-- ---------------------------------------------------------------------
-- sales — subtotal = หลังส่วนลดรายสินค้า ก่อนส่วนลดบิล ก่อน VAT
--   taxable      = subtotal - bill_discount - manual_discount
--   vat_amount   = round_half_up(taxable * vat_rate / 100, 2)
--   total_amount = taxable + vat_amount
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no varchar(20) not null unique,
  staff_id uuid not null references public.staff(id),
  shift_id uuid not null references public.shifts(id),
  status varchar(20) not null default 'completed'
    check (status in ('completed','voided','partially_returned','returned')),
  subtotal numeric(10,2) not null,
  item_discount numeric(10,2) not null default 0,
  bill_discount numeric(10,2) not null default 0,
  manual_discount numeric(10,2) not null default 0,
  vat_rate numeric(4,2) not null default 7.00,
  vat_amount numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  payment_method varchar(20) not null check (payment_method in ('cash','promptpay')),
  cash_received numeric(10,2),
  cash_change numeric(10,2),
  payment_confirmed_by uuid references public.staff(id),
  client_uuid uuid not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- sale_items — snapshot ราคา/ต้นทุน ณ เวลาขาย (§4 ต้นทุนและกำไร)
-- ---------------------------------------------------------------------
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  unit_cost numeric(10,2) not null,
  promotion_id uuid references public.promotions(id),
  discount_amount numeric(10,2) not null default 0,
  line_total_excl_vat numeric(10,2) not null,
  returned_qty integer not null default 0,
  created_at timestamptz default now()
);

alter table public.sale_items drop constraint if exists sale_items_returned_qty_chk;
alter table public.sale_items add constraint sale_items_returned_qty_chk
  check (returned_qty >= 0 and returned_qty <= quantity);

-- ---------------------------------------------------------------------
-- returns / return_items
-- ---------------------------------------------------------------------
create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  staff_id uuid not null references public.staff(id),
  reason varchar(255) not null,
  refund_amount numeric(10,2) not null,
  refund_method varchar(20) not null,
  created_at timestamptz default now()
);

-- shift_id = รอบขายที่ "เงินออกจากลิ้นชักจริง" ไม่ใช่รอบที่ขายของชิ้นนั้นไป
-- จำเป็นเพราะ close_shift ต้องหักเงินคืนออกจากรอบที่จ่ายเงินคืนไป ไม่ใช่รอบของบิลเดิม
-- (คืนของบิลเมื่อวานแต่จ่ายเงินสดวันนี้ ต้องหักจากลิ้นชักวันนี้)
-- ไม่ได้ใส่ไว้ในรายการตรวจ preflight ข้างบน เพราะเป็นคอลัมน์ที่เพิ่มทีหลัง
-- ฐานข้อมูลที่สร้างไว้ก่อนหน้านี้จะได้คอลัมน์นี้จากคำสั่งด้านล่างแทน
alter table public.returns add column if not exists shift_id uuid references public.shifts(id);

create index if not exists idx_returns_shift_id on public.returns (shift_id);

-- ใบคืนเก่าที่ยังไม่มี shift_id ให้ยึดรอบขายของบิลต้นทางไปก่อน (ข้อมูลที่ดีที่สุดที่มี)
update public.returns r
set shift_id = s.shift_id
from public.sales s
where s.id = r.sale_id
  and r.shift_id is null;

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id),
  quantity integer not null check (quantity > 0),
  restock boolean not null default true,
  refund_amount numeric(10,2) not null
);

-- ---------------------------------------------------------------------
-- store_settings — 1 แถวเท่านั้น
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  shop_name varchar(100) not null default 'Aunchan',
  address varchar(255),
  tax_id varchar(20),
  is_vat_registered boolean not null default true,
  vat_rate numeric(4,2) not null default 7.00,
  promptpay_id varchar(20),
  receipt_prefix varchar(10) not null default 'INV',
  receipt_reset_yearly boolean not null default true,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- audit_log — เขียนโดย trigger ใน 003 เท่านั้น
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  table_name varchar(30) not null,
  record_id uuid,
  action varchar(10) not null,
  changed_by uuid references public.staff(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- =====================================================================
-- Index ที่ต้องมีตาม §6
-- =====================================================================
create index if not exists idx_products_barcode            on public.products (barcode);
create index if not exists idx_products_sku                on public.products (sku);
create index if not exists idx_products_category           on public.products (category);
create index if not exists idx_inventory_product_id        on public.inventory (product_id);
create index if not exists idx_sales_created_at            on public.sales (created_at);
create index if not exists idx_sales_staff_id              on public.sales (staff_id);
create index if not exists idx_sales_shift_id              on public.sales (shift_id);
create index if not exists idx_sale_items_sale_id          on public.sale_items (sale_id);
create index if not exists idx_sale_items_product_id       on public.sale_items (product_id);
create index if not exists idx_stock_movements_product_at  on public.stock_movements (product_id, created_at);
create index if not exists idx_promotions_active_range     on public.promotions (is_active, start_date, end_date);

-- index เสริมที่จำเป็นต่อการทำงานของ RPC/RLS (ไม่ใช่ฟีเจอร์ใหม่)
create index if not exists idx_shifts_staff_open           on public.shifts (staff_id) where closed_at is null;
create index if not exists idx_return_items_sale_item      on public.return_items (sale_item_id);
create index if not exists idx_returns_sale_id             on public.returns (sale_id);

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
declare
  v_missing text;
begin
  select string_agg(t, ', ')
    into v_missing
  from unnest(array['staff','suppliers','products','inventory','stock_movements','shifts',
                    'promotions','sales','sale_items','returns','return_items',
                    'store_settings','audit_log']) t
  where to_regclass('public.' || t) is null;

  if v_missing is not null then
    raise exception '001_tables: ตารางที่ยังไม่ถูกสร้าง: %', v_missing;
  end if;

  raise notice '001_tables: สร้างตารางครบ 13 ตารางและ index ทั้งหมดแล้ว';
end $$;
