-- =====================================================================
-- Aunchan POS — 000_migration_status.sql
-- ตรวจว่า migration ไฟล์ไหนลงครบแล้วบ้าง (อ่านอย่างเดียว ไม่แก้ข้อมูล)
-- วางทั้งไฟล์ใน Supabase SQL Editor แล้ว Run
-- คอลัมน์ "สถานะ" ต้องเป็น OK ทุกแถวจึงจะพร้อมรันชุดทดสอบ §10
-- =====================================================================

with
-- 001 ----------------------------------------------------------------
tables as (
  select '001_tables' as ไฟล์, 'ตาราง 13 ตัว' as รายการ,
         count(*)::text || ' / 13' as ผลจริง,
         case when count(*) = 13 then 'OK' else 'ขาด' end as สถานะ
  from unnest(array['staff','suppliers','products','inventory','stock_movements','shifts',
                    'promotions','sales','sale_items','returns','return_items',
                    'store_settings','audit_log']) t
  where to_regclass('public.' || t) is not null
),
idx as (
  select '001_tables', 'index ที่สเปกกำหนด',
         count(*)::text || ' / 11',
         case when count(*) = 11 then 'OK' else 'ขาด' end
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('idx_products_barcode','idx_products_sku','idx_products_category',
                      'idx_inventory_product_id','idx_sales_created_at','idx_sales_staff_id',
                      'idx_sales_shift_id','idx_sale_items_sale_id','idx_sale_items_product_id',
                      'idx_stock_movements_product_at','idx_promotions_active_range')
),
promo_chk as (
  select '001_tables', 'CHECK ชนิดส่วนลดของโปรโมชั่น',
         coalesce(string_agg(conname, ', '), '(ไม่มี)'),
         case when count(*) = 3 then 'OK' else 'ขาด' end
  from pg_constraint
  where conrelid = to_regclass('public.promotions')
    and conname in ('promotions_scope_discount_type_chk','promotions_discount_value_chk',
                    'promotions_date_range_chk')
),
-- 002 ----------------------------------------------------------------
rls as (
  select '002_rls', 'ตารางที่เปิด RLS',
         count(*) filter (where c.relrowsecurity)::text || ' / 13',
         case when count(*) filter (where c.relrowsecurity) = 13 then 'OK' else 'ยังไม่เปิดครบ' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('staff','suppliers','products','inventory','stock_movements','shifts',
                      'promotions','sales','sale_items','returns','return_items',
                      'store_settings','audit_log')
),
policies as (
  select '002_rls', 'จำนวน policy ทั้งหมด',
         count(*)::text || ' (คาด 19)',
         case when count(*) >= 19 then 'OK' else 'ขาด' end
  from pg_policies where schemaname = 'public'
),
helper as (
  select '002_rls', 'helper is_owner / is_active_staff',
         count(*)::text || ' / 2',
         case when count(*) = 2 then 'OK' else 'ขาด' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('is_owner','is_active_staff')
),
staff_view as (
  select '002_rls', 'view products_for_staff (ต้องไม่มี cost_price)',
         case when to_regclass('public.products_for_staff') is null then '(ไม่มี view)'
              when exists (select 1 from information_schema.columns
                           where table_schema='public' and table_name='products_for_staff'
                             and column_name='cost_price') then 'มี cost_price หลุดออกมา'
              else 'ไม่มี cost_price' end,
         case when to_regclass('public.products_for_staff') is not null
               and not exists (select 1 from information_schema.columns
                               where table_schema='public' and table_name='products_for_staff'
                                 and column_name='cost_price')
              then 'OK' else 'ผิด' end
),
-- 003 ----------------------------------------------------------------
trg as (
  select '003_triggers', 'trigger ทั้งหมด (updated_at 7 + reason 1 + audit 4)',
         count(*)::text || ' / 12',
         case when count(*) = 12 then 'OK' else 'ขาด' end
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
    and t.tgname in ('set_updated_at','stock_movement_require_reason','audit_changes')
),
fn3 as (
  select '003_triggers', 'ฟังก์ชัน round_half_up / next_receipt_no',
         count(*)::text || ' / 2',
         case when count(*) = 2 then 'OK' else 'ขาด' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('round_half_up','next_receipt_no')
),
-- 004 / 006 ----------------------------------------------------------
fn4 as (
  select '004_rpc_checkout', 'ฟังก์ชัน checkout_sale',
         case when to_regprocedure('public.checkout_sale(uuid,uuid,jsonb,text,numeric,numeric)') is null
              then '(ไม่มี)' else 'มีแล้ว' end,
         case when to_regprocedure('public.checkout_sale(uuid,uuid,jsonb,text,numeric,numeric)') is null
              then 'ยังไม่ได้รัน' else 'OK' end
),
fn6 as (
  select '006_rpc_shift', 'ฟังก์ชัน open_shift / close_shift + view shift_summary',
         (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname in ('open_shift','close_shift'))
         || ' / 2 ฟังก์ชัน · view: '
         || case when to_regclass('public.shift_summary') is null then 'ไม่มี' else 'มี' end,
         case when to_regclass('public.shift_summary') is not null
               and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname='public' and p.proname in ('open_shift','close_shift')) = 2
              then 'OK' else 'ยังไม่ได้รัน' end
),
-- 007 ----------------------------------------------------------------
seed_users as (
  select '007_seed', 'บัญชีใน auth.users + ตาราง staff',
         (select count(*)::text from auth.users
          where email in ('owner@aunchan.local','staff@aunchan.local')) || ' / 2 auth · '
         || (select count(*)::text from public.staff) || ' staff',
         case when (select count(*) from auth.users
                    where email in ('owner@aunchan.local','staff@aunchan.local')) = 2
               and (select count(*) from public.staff) >= 2
              then 'OK' else 'ยังไม่ได้ seed' end
),
seed_data as (
  select '007_seed', 'ข้อมูลตัวอย่าง (สินค้า / ซัพพลายเออร์ / โปรโมชั่น / บิล)',
         (select count(*)::text from public.products)    || ' สินค้า · ' ||
         (select count(*)::text from public.suppliers)   || ' ซัพพลายเออร์ · ' ||
         (select count(*)::text from public.promotions)  || ' โปรโมชั่น · ' ||
         (select count(*)::text from public.sales)       || ' บิล',
         case when (select count(*) from public.products) >= 20
               and (select count(*) from public.promotions) >= 2
               and (select count(*) from public.sales) >= 30
              then 'OK' else 'ยังไม่ครบ' end
),
seed_settings as (
  select '007_seed', 'store_settings 1 แถว',
         coalesce((select shop_name || ' · VAT ' || vat_rate || '%'
                   from public.store_settings where id = 1), '(ไม่มีแถว)'),
         case when exists (select 1 from public.store_settings where id = 1)
              then 'OK' else 'ยังไม่ได้ seed' end
),
low_stock as (
  select '007_seed', 'สินค้าที่ถึงจุดสั่งซื้อ (ต้องมีอย่างน้อย 3)',
         (select count(*)::text from public.products p
          join public.inventory i on i.product_id = p.id
          where p.is_active and i.quantity <= i.reorder_point) || ' รายการ',
         case when (select count(*) from public.products p
                    join public.inventory i on i.product_id = p.id
                    where p.is_active and i.quantity <= i.reorder_point) >= 3
              then 'OK' else 'ยังไม่ครบ' end
),
-- §10 ข้อ 8 ------------------------------------------------------------
invariant as (
  select 'เกณฑ์ §10 ข้อ 8', 'inventory.quantity = SUM(stock_movements.qty_change)',
         (select count(*)::text from (
            select p.id
            from public.products p
            join public.inventory inv on inv.product_id = p.id
            left join public.stock_movements sm on sm.product_id = p.id
            group by p.id, inv.quantity
            having inv.quantity <> coalesce(sum(sm.qty_change), 0)
          ) x) || ' รายการที่ไม่ตรง',
         case when (select count(*) from (
            select p.id
            from public.products p
            join public.inventory inv on inv.product_id = p.id
            left join public.stock_movements sm on sm.product_id = p.id
            group by p.id, inv.quantity
            having inv.quantity <> coalesce(sum(sm.qty_change), 0)
          ) x) = 0 then 'OK' else 'สต็อกไม่ตรง' end
)
select * from tables
union all select * from idx
union all select * from promo_chk
union all select * from rls
union all select * from policies
union all select * from helper
union all select * from staff_view
union all select * from trg
union all select * from fn3
union all select * from fn4
union all select * from fn6
union all select * from seed_users
union all select * from seed_data
union all select * from seed_settings
union all select * from low_stock
union all select * from invariant;
