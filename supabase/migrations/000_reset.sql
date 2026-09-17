-- =====================================================================
-- Aunchan POS — 000_reset.sql
-- !! ลบข้อมูลถาวร กู้คืนไม่ได้ !!
--
-- ใช้เมื่อฐานข้อมูลมีตารางชื่อเดียวกันจากระบบเดิมค้างอยู่ จนรัน 001 ไม่ผ่าน
-- ก่อนรัน: ยืนยันให้แน่ใจว่าตารางเหล่านี้ไม่มีข้อมูลที่ต้องเก็บ
-- ตรวจดูก่อนได้ด้วย query นี้:
--
--   select table_name,
--          string_agg(column_name, ', ' order by ordinal_position) as columns
--   from information_schema.columns
--   where table_schema = 'public'
--   group by table_name
--   order by table_name;
--
-- ไฟล์นี้ไม่แตะ schema auth — บัญชีผู้ใช้ที่สมัครไว้ยังอยู่ครบ
-- (ถ้าต้องการลบบัญชีทดสอบของ Aunchan ด้วย ให้เอาคอมเมนต์บล็อกท้ายไฟล์ออก)
-- =====================================================================

-- view ก่อน เพราะอ้างถึงตาราง
drop view if exists public.shift_summary;
drop view if exists public.sales_daily_summary;
drop view if exists public.low_stock_products;
drop view if exists public.products_for_staff;
drop view if exists public.sale_items_for_staff;

-- ตาราง (cascade เพื่อลบ FK, trigger และ policy ที่ผูกอยู่)
drop table if exists public.return_items    cascade;
drop table if exists public.returns         cascade;
drop table if exists public.sale_items      cascade;
drop table if exists public.sales           cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.inventory       cascade;
drop table if exists public.promotions      cascade;
drop table if exists public.products        cascade;
drop table if exists public.suppliers       cascade;
drop table if exists public.shifts          cascade;
drop table if exists public.staff           cascade;
drop table if exists public.store_settings  cascade;
drop table if exists public.audit_log       cascade;

-- ฟังก์ชันของระบบ
drop function if exists public.checkout_sale(uuid, uuid, jsonb, text, numeric, numeric);
drop function if exists public.receive_stock(uuid, jsonb);
drop function if exists public.adjust_stock(uuid, integer, text);
drop function if exists public.record_waste(uuid, integer, text);
drop function if exists public.create_return(uuid, jsonb, text);
drop function if exists public.void_sale(uuid, text);
drop function if exists public.open_shift(numeric);
drop function if exists public.close_shift(uuid, numeric);
drop function if exists public.next_receipt_no(timestamptz);
drop function if exists public.round_half_up(numeric, integer);
drop function if exists public.is_owner();
drop function if exists public.is_active_staff();
drop function if exists public.tg_set_updated_at();
drop function if exists public.tg_stock_movement_require_reason();
drop function if exists public.tg_audit_log();

-- ---------------------------------------------------------------------
-- ลบบัญชีทดสอบของ Aunchan ใน Supabase Auth ด้วย
-- เอาคอมเมนต์ออกเฉพาะเมื่อต้องการให้ 007_seed.sql สร้างบัญชีใหม่ทั้งหมด
-- ---------------------------------------------------------------------
-- delete from auth.identities
--  where user_id in (select id from auth.users
--                    where email in ('owner@aunchan.local','staff@aunchan.local'));
-- delete from auth.users
--  where email in ('owner@aunchan.local','staff@aunchan.local');

do $$
declare
  v_left text;
begin
  select string_agg(t, ', ')
    into v_left
  from unnest(array['staff','suppliers','products','inventory','stock_movements','shifts',
                    'promotions','sales','sale_items','returns','return_items',
                    'store_settings','audit_log']) t
  where to_regclass('public.' || t) is not null;

  if v_left is not null then
    raise exception '000_reset: ยังลบไม่หมด เหลือ: %', v_left;
  end if;

  raise notice '000_reset: ล้างตารางและฟังก์ชันของระบบเรียบร้อย รัน 001 ต่อได้เลย';
end $$;
