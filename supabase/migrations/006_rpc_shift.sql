-- =====================================================================
-- Aunchan POS — 006_rpc_shift.sql
-- RPC รอบขาย: open_shift, close_shift (§7.7, §7.8) + view สรุปยอดของรอบขาย
-- concern เดียว: รอบขาย
-- รันซ้ำได้อย่างปลอดภัย
-- =====================================================================
--
-- open_shift
--   input : p_opening_cash numeric  เงินตั้งต้นในลิ้นชัก
--   output: แถวของตาราง shifts
--   error : ต้องเข้าสู่ระบบ / บัญชีถูกปิด / เงินตั้งต้นติดลบ / มีรอบขายที่ยังไม่ปิดอยู่แล้ว
--   สิทธิ์ : owner และ staff (เปิดรอบของตัวเองเท่านั้น)
--
-- close_shift
--   input : p_shift_id uuid, p_counted_cash numeric  เงินสดที่นับได้จริง
--   output: แถวของตาราง shifts พร้อม expected_cash / counted_cash / cash_diff
--   error : ไม่พบรอบขาย / รอบขายปิดไปแล้ว / ปิดได้เฉพาะรอบขายของตัวเอง / เงินที่นับติดลบ
--   สิทธิ์ : เจ้าของรอบขายนั้น หรือ owner
--   สูตร  : expected_cash = opening_cash + ยอดขายเงินสดในรอบ (ไม่นับบิลที่ยกเลิก)
--                          - เงินคืนที่จ่ายเป็นเงินสดออกจากลิ้นชักของรอบนั้น
--                            (นับจาก returns.shift_id = รอบที่จ่ายเงินคืนจริง)
--           cash_diff     = counted_cash - expected_cash   (ลบ = เงินขาด)
-- =====================================================================

-- ---------------------------------------------------------------------
-- open_shift
-- ---------------------------------------------------------------------
create or replace function public.open_shift(p_opening_cash numeric)
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_shift    public.shifts;
begin
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนเปิดรอบขาย';
  end if;

  if not public.is_active_staff() then
    raise exception 'บัญชีผู้ใช้นี้ถูกปิดการใช้งาน';
  end if;

  if coalesce(p_opening_cash, 0) < 0 then
    raise exception 'เงินตั้งต้นในลิ้นชักต้องไม่ติดลบ';
  end if;

  select * into v_shift
  from public.shifts
  where staff_id = v_staff_id and closed_at is null
  limit 1;

  if found then
    raise exception 'มีรอบขายที่ยังไม่ปิดอยู่แล้ว (เปิดเมื่อ %)',
      to_char(v_shift.opened_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI');
  end if;

  insert into public.shifts (staff_id, opening_cash)
  values (v_staff_id, public.round_half_up(coalesce(p_opening_cash, 0), 2))
  returning * into v_shift;

  return v_shift;
end;
$$;

-- ---------------------------------------------------------------------
-- close_shift — บันทึกผลต่างเงินสดลงฐานข้อมูล ไม่ใช่แค่แสดงแล้วหาย (§4, §7.7)
-- ---------------------------------------------------------------------
create or replace function public.close_shift(p_shift_id uuid, p_counted_cash numeric)
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id  uuid := auth.uid();
  v_shift     public.shifts;
  v_cash_in   numeric(10,2);
  v_cash_out  numeric(10,2);
  v_expected  numeric(10,2);
  v_counted   numeric(10,2);
begin
  if v_staff_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนปิดรอบขาย';
  end if;

  if coalesce(p_counted_cash, 0) < 0 then
    raise exception 'เงินสดที่นับได้ต้องไม่ติดลบ';
  end if;

  select * into v_shift from public.shifts where id = p_shift_id for update;
  if not found then
    raise exception 'ไม่พบรอบขายที่ระบุ';
  end if;

  if v_shift.staff_id <> v_staff_id and not public.is_owner() then
    raise exception 'ปิดได้เฉพาะรอบขายของตัวเองเท่านั้น';
  end if;

  if v_shift.closed_at is not null then
    raise exception 'รอบขายนี้ปิดไปแล้วเมื่อ %',
      to_char(v_shift.closed_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI');
  end if;

  -- ยอดขายเงินสดในรอบ (บิลที่ยกเลิกไม่นับ)
  select coalesce(sum(s.total_amount), 0)
    into v_cash_in
  from public.sales s
  where s.shift_id = v_shift.id
    and s.payment_method = 'cash'
    and s.status <> 'voided';

  -- เงินคืนที่จ่ายเป็นเงินสด "ออกจากลิ้นชักของรอบนี้"
  -- ยึด returns.shift_id ไม่ใช่รอบของบิลเดิม เพราะคืนของบิลเมื่อวานแต่จ่ายเงินวันนี้
  -- เงินก็หายไปจากลิ้นชักวันนี้ (§4 ปิดรอบต้องตรงกับเงินจริงในลิ้นชัก)
  select coalesce(sum(r.refund_amount), 0)
    into v_cash_out
  from public.returns r
  where r.shift_id = v_shift.id
    and r.refund_method = 'cash';

  v_expected := public.round_half_up(v_shift.opening_cash + v_cash_in - v_cash_out, 2);
  v_counted  := public.round_half_up(coalesce(p_counted_cash, 0), 2);

  update public.shifts
  set closed_at     = now(),
      expected_cash = v_expected,
      counted_cash  = v_counted,
      cash_diff     = v_counted - v_expected
  where id = v_shift.id
  returning * into v_shift;

  return v_shift;
end;
$$;

revoke all on function public.open_shift(numeric) from public, anon;
revoke all on function public.close_shift(uuid, numeric) from public, anon;
grant execute on function public.open_shift(numeric) to authenticated;
grant execute on function public.close_shift(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- view สรุปยอดของรอบขายแยกช่องทาง (§4 "ปิดรอบ: ระบบสรุปยอดขายแยกช่องทาง")
-- security_invoker = true → ผู้เรียกเห็นเฉพาะรอบขายที่ RLS อนุญาต
-- การรวมยอดทำฝั่งเซิร์ฟเวอร์ หน้าเว็บอ่านค่าไปแสดงตรง ๆ ห้ามบวกเอง
-- ---------------------------------------------------------------------
drop view if exists public.shift_summary;
create view public.shift_summary
with (security_invoker = true) as
  select
    sh.id                as shift_id,
    sh.staff_id,
    sh.opened_at,
    sh.closed_at,
    sh.opening_cash,
    sh.expected_cash,
    sh.counted_cash,
    sh.cash_diff,
    count(s.id) filter (where s.status <> 'voided')                          as bill_count,
    count(s.id) filter (where s.status = 'voided')                           as voided_count,
    coalesce(sum(s.total_amount) filter (
      where s.status <> 'voided' and s.payment_method = 'cash'), 0)          as cash_sales,
    coalesce(sum(s.total_amount) filter (
      where s.status <> 'voided' and s.payment_method = 'promptpay'), 0)     as promptpay_sales,
    coalesce(sum(s.total_amount) filter (where s.status <> 'voided'), 0)     as total_sales,
    coalesce(sum(s.vat_amount)   filter (where s.status <> 'voided'), 0)     as vat_total
  from public.shifts sh
  left join public.sales s on s.shift_id = sh.id
  group by sh.id;

revoke all on public.shift_summary from public, anon;
grant select on public.shift_summary to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
begin
  if to_regprocedure('public.open_shift(numeric)') is null
     or to_regprocedure('public.close_shift(uuid,numeric)') is null then
    raise exception '006_rpc_shift: สร้างฟังก์ชันไม่ครบ';
  end if;
  raise notice '006_rpc_shift: สร้าง open_shift, close_shift และ view shift_summary แล้ว';
end $$;
