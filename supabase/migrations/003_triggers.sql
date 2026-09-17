-- =====================================================================
-- Aunchan POS — 003_triggers.sql
-- trigger 4 กลุ่มตาม §6 + helper การปัดเศษเงินและเลขที่บิล
-- concern เดียว: กฎที่ฐานข้อมูลบังคับเองโดยไม่พึ่งโค้ดฝั่งเรียก
-- รันซ้ำได้อย่างปลอดภัย
-- =====================================================================

-- ---------------------------------------------------------------------
-- helper: ปัดเศษเงินแบบ half-up ที่เดียวของทั้งระบบ (§7.5)
-- หมายเหตุ: round() ของชนิด numeric ใน PostgreSQL ปัดแบบ half-up
-- (away from zero) อยู่แล้ว — ต่างจาก double precision ที่ปัดแบบ half-even
-- จึงห้ามใช้ float กับเงินทุกกรณี (§7.4)
-- ---------------------------------------------------------------------
create or replace function public.round_half_up(p_value numeric, p_scale integer default 2)
returns numeric
language sql
immutable
as $$
  select round(p_value, p_scale);
$$;

-- =====================================================================
-- 1. updated_at อัปเดตอัตโนมัติ
-- =====================================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['staff','suppliers','products','inventory',
                           'promotions','sales','store_settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
-- 2. บังคับ stock_movements.reason เมื่อ type in ('adjust','waste')  (§4 ห้ามทำ ข้อ 3)
-- =====================================================================
create or replace function public.tg_stock_movement_require_reason()
returns trigger
language plpgsql
as $$
begin
  if new.type in ('adjust','waste')
     and (new.reason is null or btrim(new.reason) = '') then
    raise exception 'ต้องระบุเหตุผลเมื่อปรับยอดสต็อกหรือบันทึกของเสีย (type = %)', new.type
      using errcode = 'check_violation';
  end if;

  if new.qty_change = 0 then
    raise exception 'จำนวนที่เปลี่ยนแปลงต้องไม่เป็นศูนย์'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_movement_require_reason on public.stock_movements;
create trigger stock_movement_require_reason
  before insert or update on public.stock_movements
  for each row execute function public.tg_stock_movement_require_reason();

-- =====================================================================
-- 3. audit log 4 ตาราง: products, stock_movements, sales, staff  (§4 ต้องทำ ข้อ 4)
-- =====================================================================
create or replace function public.tg_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := auth.uid();
  v_record uuid;
begin
  if tg_op = 'DELETE' then
    v_record := (to_jsonb(old) ->> 'id')::uuid;
  else
    v_record := (to_jsonb(new) ->> 'id')::uuid;
  end if;

  insert into public.audit_log (table_name, record_id, action, changed_by, old_data, new_data)
  values (
    tg_table_name,
    v_record,
    lower(tg_op),
    (select s.id from public.staff s where s.id = v_actor),   -- null ได้ถ้ารันจาก SQL editor
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['products','stock_movements','sales','staff']
  loop
    execute format('drop trigger if exists audit_changes on public.%I', t);
    execute format(
      'create trigger audit_changes after insert or update or delete on public.%I
       for each row execute function public.tg_audit_log()', t);
  end loop;
end $$;

-- =====================================================================
-- 4. เลขที่บิล — ออกเลขในฟังก์ชันปิดบิลเท่านั้น ห้ามออกจากเบราว์เซอร์ (§6)
--    รูปแบบ INV-2026-000123 · รีเซ็ตรายปีตาม store_settings.receipt_reset_yearly
--    ใช้ advisory lock ต่อปีแทน sequence object เพื่อให้เลขเรียงติดกันไม่มีช่องว่าง
--    (sequence จะกินเลขทิ้งเมื่อธุรกรรมถูก rollback เช่นกรณีสต็อกไม่พอ)
-- =====================================================================
create or replace function public.next_receipt_no(p_at timestamptz default now())
returns varchar
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix  text;
  v_yearly  boolean;
  v_year    text;
  v_like    text;
  v_last    integer;
begin
  select receipt_prefix, receipt_reset_yearly
    into v_prefix, v_yearly
  from public.store_settings
  where id = 1;

  v_prefix := coalesce(v_prefix, 'INV');
  v_yearly := coalesce(v_yearly, true);

  -- ปี ค.ศ. ตามเวลาหน้าร้าน (เก็บเวลาใน DB เป็น UTC ตาม §6 แต่เลขบิลนับตามวันของร้าน)
  v_year := to_char(p_at at time zone 'Asia/Bangkok', 'YYYY');

  perform pg_advisory_xact_lock(hashtext('aunchan_receipt_' || case when v_yearly then v_year else 'all' end));

  if v_yearly then
    v_like := v_prefix || '-' || v_year || '-%';
  else
    v_like := v_prefix || '-%';
  end if;

  select coalesce(max((regexp_replace(receipt_no, '^.*-', ''))::integer), 0)
    into v_last
  from public.sales
  where receipt_no like v_like;

  return v_prefix || '-' || v_year || '-' || lpad((v_last + 1)::text, 6, '0');
end;
$$;

revoke all on function public.next_receipt_no(timestamptz) from public, anon, authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
declare
  v_missing text;
begin
  select string_agg(x.tbl || '.' || x.trg, ', ')
    into v_missing
  from (
    values ('staff','set_updated_at'), ('suppliers','set_updated_at'), ('products','set_updated_at'),
           ('inventory','set_updated_at'), ('promotions','set_updated_at'), ('sales','set_updated_at'),
           ('store_settings','set_updated_at'),
           ('stock_movements','stock_movement_require_reason'),
           ('products','audit_changes'), ('stock_movements','audit_changes'),
           ('sales','audit_changes'), ('staff','audit_changes')
  ) as x(tbl, trg)
  where not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = x.tbl and t.tgname = x.trg and not t.tgisinternal
  );

  if v_missing is not null then
    raise exception '003_triggers: trigger ที่ยังไม่ถูกสร้าง: %', v_missing;
  end if;

  raise notice '003_triggers: สร้าง trigger ครบ 4 กลุ่ม + ฟังก์ชัน next_receipt_no แล้ว';
end $$;
