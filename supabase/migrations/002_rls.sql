-- =====================================================================
-- Aunchan POS — 002_rls.sql
-- helper function + RLS policy ทุกตาราง + view ที่ซ่อน cost_price จาก staff
-- concern เดียว: สิทธิ์การเข้าถึงข้อมูล (§2, §6)
-- รันซ้ำได้อย่างปลอดภัย (drop policy if exists ก่อนสร้างทุกตัว)
-- =====================================================================
--
-- หลักการ:
--   1. สิทธิ์ทุกข้อบังคับที่ฐานข้อมูล ไม่ใช่แค่ซ่อนเมนูใน React (§2)
--   2. role อ่านจากตาราง staff เท่านั้น ห้ามอ่านจาก user_metadata (§1)
--   3. การเขียน sales / sale_items / stock_movements / shifts ทำผ่าน RPC
--      security definer ใน 004 และ 006 เท่านั้น — ไม่มี policy ให้เขียนตรง
-- =====================================================================

-- ---------------------------------------------------------------------
-- helper function — security definer เพื่ออ่านตาราง staff โดยไม่ติด RLS ของตัวเอง
-- ---------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.role = 'owner' and s.is_active
  );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.is_active
  );
$$;

revoke all on function public.is_owner() from public, anon;
revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_active_staff() to authenticated;

-- ---------------------------------------------------------------------
-- เปิด RLS ทุกตาราง
-- ---------------------------------------------------------------------
alter table public.staff            enable row level security;
alter table public.suppliers        enable row level security;
alter table public.products         enable row level security;
alter table public.inventory        enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.shifts           enable row level security;
alter table public.promotions       enable row level security;
alter table public.sales            enable row level security;
alter table public.sale_items       enable row level security;
alter table public.returns          enable row level security;
alter table public.return_items     enable row level security;
alter table public.store_settings   enable row level security;
alter table public.audit_log        enable row level security;

-- ---------------------------------------------------------------------
-- staff — owner จัดการได้ทั้งหมด / staff อ่านได้เฉพาะแถวของตัวเอง
-- (จำเป็นเพื่อให้หน้าเว็บรู้ชื่อและ role ของผู้ใช้ที่ล็อกอิน)
-- ---------------------------------------------------------------------
drop policy if exists staff_select_self on public.staff;
create policy staff_select_self on public.staff
  for select to authenticated
  using (id = auth.uid() or public.is_owner());

drop policy if exists staff_owner_write on public.staff;
create policy staff_owner_write on public.staff
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- กันเจ้าของร้านล็อกตัวเองออกจากระบบ — บังคับที่ฐานข้อมูล ไม่ใช่แค่ปิดปุ่มในหน้าเว็บ
-- อยู่ในไฟล์นี้เพราะเป็นกติกาเรื่อง "สิทธิ์" ไม่ใช่ trigger ทั่วไปของตาราง
--
-- กันไว้ 2 ชั้น
--   1. บัญชีตัวเอง: ลดสิทธิ์ตัวเอง ปิดบัญชีตัวเอง หรือลบบัญชีตัวเองไม่ได้
--   2. ทั้งร้าน: ต้องเหลือเจ้าของร้านที่ใช้งานอยู่อย่างน้อย 1 คนเสมอ
--
-- auth.uid() เป็น null เมื่อรันจาก SQL Editor ด้วย role postgres
-- ชั้นที่ 1 จึงไม่ทำงานในกรณีนั้น — เป็นทางออกฉุกเฉินที่ตั้งใจให้มี
-- ส่วนชั้นที่ 2 ทำงานเสมอ กันไม่ให้ร้านไม่มีเจ้าของเหลืออยู่เลย
-- ---------------------------------------------------------------------
create or replace function public.tg_staff_protect_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.staff := case when tg_op = 'DELETE' then old else new end;
begin
  -- ชั้นที่ 1 — บัญชีของผู้ที่กำลังกระทำเอง
  if old.id = auth.uid() then
    if tg_op = 'DELETE' then
      raise exception 'ลบบัญชีของตัวเองไม่ได้';
    end if;

    if old.role = 'owner' and new.role <> 'owner' then
      raise exception 'ลดสิทธิ์ของบัญชีตัวเองไม่ได้ ให้เจ้าของร้านอีกคนเป็นผู้เปลี่ยนให้';
    end if;

    if old.is_active and not new.is_active then
      raise exception 'ปิดบัญชีของตัวเองไม่ได้ จะเข้าระบบไม่ได้อีกเลย';
    end if;
  end if;

  -- ชั้นที่ 2 — ต้องเหลือเจ้าของร้านที่ใช้งานอยู่เสมอ
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active) then
    if not exists (
      select 1 from public.staff s
      where s.role = 'owner' and s.is_active and s.id <> old.id
    ) then
      raise exception 'ต้องมีเจ้าของร้านที่ใช้งานอยู่อย่างน้อย 1 คน '
                      'ตั้งเจ้าของร้านคนใหม่ก่อนแล้วค่อยเปลี่ยนบัญชีนี้';
    end if;
  end if;

  return v_row;
end;
$$;

drop trigger if exists staff_protect_owner on public.staff;
create trigger staff_protect_owner
  before update or delete on public.staff
  for each row execute function public.tg_staff_protect_owner();

-- ---------------------------------------------------------------------
-- suppliers — staff อ่านได้ / owner เขียนได้
-- ---------------------------------------------------------------------
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists suppliers_owner_write on public.suppliers;
create policy suppliers_owner_write on public.suppliers
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- products — owner เท่านั้นที่อ่านตารางตรงได้ (เพราะมีคอลัมน์ cost_price)
-- staff อ่านผ่าน view public.products_for_staff ด้านล่าง
-- ---------------------------------------------------------------------
drop policy if exists products_owner_read on public.products;
create policy products_owner_read on public.products
  for select to authenticated
  using (public.is_owner());

drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- view สำหรับ staff: ไม่มี cost_price อยู่ในคอลัมน์เลย
-- ไม่ใช้ security_invoker → view ทำงานด้วยสิทธิ์เจ้าของ view จึงข้าม RLS ของ products ได้
-- แต่เปิดเผยเฉพาะคอลัมน์ที่อนุญาต (การป้องกันจริงอยู่ที่ "ไม่มีคอลัมน์ต้นทุนใน view")
create or replace view public.products_for_staff as
  select
    p.id,
    p.supplier_id,
    p.name,
    p.sku,
    p.category,
    p.unit,
    p.price,
    p.is_vat_exempt,
    p.image_url,
    p.barcode,
    p.is_active,
    p.created_at,
    p.updated_at
  from public.products p;

revoke all on public.products_for_staff from public, anon;
grant select on public.products_for_staff to authenticated;

-- ---------------------------------------------------------------------
-- inventory — staff อ่านได้ (หน้า POS + ดูสต็อก) / เขียนผ่าน RPC เท่านั้น
-- ---------------------------------------------------------------------
drop policy if exists inventory_read on public.inventory;
create policy inventory_read on public.inventory
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists inventory_owner_write on public.inventory;
create policy inventory_owner_write on public.inventory
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- promotions — staff อ่านได้ / owner เขียนได้
-- ---------------------------------------------------------------------
drop policy if exists promotions_read on public.promotions;
create policy promotions_read on public.promotions
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists promotions_owner_write on public.promotions;
create policy promotions_owner_write on public.promotions
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- stock_movements — owner เท่านั้น (staff เขียนผ่าน RPC ปิดบิล ซึ่งเป็น security definer)
-- ---------------------------------------------------------------------
drop policy if exists stock_movements_owner_read on public.stock_movements;
create policy stock_movements_owner_read on public.stock_movements
  for select to authenticated
  using (public.is_owner());

drop policy if exists stock_movements_owner_write on public.stock_movements;
create policy stock_movements_owner_write on public.stock_movements
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- shifts — owner เห็นทุกแถว / staff เห็นเฉพาะรอบขายของตัวเอง
-- (staff ต้องอ่านรอบของตัวเองได้ เพราะ §2 ให้เปิด-ปิดรอบขายของตัวเอง
--  และ §4 กำหนดว่าขายได้เฉพาะเมื่อมีรอบขายที่เปิดอยู่ของผู้ใช้คนนั้น)
-- การเขียนทำผ่าน open_shift / close_shift เท่านั้น
-- ---------------------------------------------------------------------
drop policy if exists shifts_read on public.shifts;
create policy shifts_read on public.shifts
  for select to authenticated
  using (public.is_owner() or staff_id = auth.uid());

drop policy if exists shifts_owner_write on public.shifts;
create policy shifts_owner_write on public.shifts
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- sales — owner เห็นทั้งร้าน / staff เห็นเฉพาะบิลใน shift ของตัวเอง (§2)
-- ไม่มี policy insert/update ให้ client — เขียนผ่าน checkout_sale เท่านั้น
-- ---------------------------------------------------------------------
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales
  for select to authenticated
  using (
    public.is_owner()
    or exists (
      select 1 from public.shifts sh
      where sh.id = sales.shift_id and sh.staff_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- sale_items — owner เท่านั้นที่อ่านตารางตรง ๆ ได้ เพราะมีคอลัมน์ unit_cost
-- staff อ่านผ่าน view sale_items_for_staff ที่ไม่มีคอลัมน์ต้นทุน (§2 staff ห้ามเห็นต้นทุน)
-- ---------------------------------------------------------------------
drop policy if exists sale_items_read on public.sale_items;
create policy sale_items_read on public.sale_items
  for select to authenticated
  using (public.is_owner());

-- view สำหรับ staff: ตัดคอลัมน์ unit_cost ออก แล้วคัดแถวด้วยเงื่อนไขเดิม
-- (บิลของรอบขายตัวเองเท่านั้น) — หลักการเดียวกับ products_for_staff
-- ไม่ใช้ security_invoker → view ข้าม RLS ของ sale_items ได้ การคัดแถวจึงต้องเขียนไว้ใน where
create or replace view public.sale_items_for_staff as
  select
    si.id,
    si.sale_id,
    si.product_id,
    si.quantity,
    si.unit_price,
    si.promotion_id,
    si.discount_amount,
    si.line_total_excl_vat,
    si.returned_qty,
    si.created_at
  from public.sale_items si
  where public.is_owner()
     or exists (
       select 1
       from public.sales s
       join public.shifts sh on sh.id = s.shift_id
       where s.id = si.sale_id and sh.staff_id = auth.uid()
     );

revoke all on public.sale_items_for_staff from public, anon;
grant select on public.sale_items_for_staff to authenticated;

-- ---------------------------------------------------------------------
-- returns / return_items — owner เท่านั้น (§2 คืนสินค้าเป็นสิทธิ์ owner)
-- ---------------------------------------------------------------------
drop policy if exists returns_owner_all on public.returns;
create policy returns_owner_all on public.returns
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists return_items_owner_all on public.return_items;
create policy return_items_owner_all on public.return_items
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- store_settings — owner แก้ไขได้
-- staff อ่านได้เพราะหัวใบเสร็จต้องใช้ shop_name/address/tax_id
-- และ QR พร้อมเพย์ต้องใช้ promptpay_id (§4 การชำระเงิน, §5 หน้า 2)
-- ---------------------------------------------------------------------
drop policy if exists store_settings_read on public.store_settings;
create policy store_settings_read on public.store_settings
  for select to authenticated
  using (public.is_active_staff());

drop policy if exists store_settings_owner_write on public.store_settings;
create policy store_settings_owner_write on public.store_settings
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- audit_log — owner อ่านได้อย่างเดียว เขียนโดย trigger (security definer) เท่านั้น
-- ---------------------------------------------------------------------
drop policy if exists audit_log_owner_read on public.audit_log;
create policy audit_log_owner_read on public.audit_log
  for select to authenticated
  using (public.is_owner());

-- ---------------------------------------------------------------------
-- ตัดสิทธิ์ผู้ใช้ที่ยังไม่ล็อกอินออกจากทุกตาราง
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
declare
  v_open text;
begin
  select string_agg(c.relname, ', ')
    into v_open
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity = false;

  if v_open is not null then
    raise exception '002_rls: ตารางที่ยังไม่เปิด RLS: %', v_open;
  end if;

  if to_regclass('public.products_for_staff') is null
     or to_regclass('public.sale_items_for_staff') is null then
    raise exception '002_rls: สร้าง view สำหรับ staff ไม่ครบ';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'staff_protect_owner' and not tgisinternal
  ) then
    raise exception '002_rls: ไม่พบ trigger staff_protect_owner';
  end if;

  raise notice '002_rls: เปิด RLS ครบทุกตาราง + สร้าง view products_for_staff และ sale_items_for_staff แล้ว';
end $$;
