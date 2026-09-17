-- =====================================================================
-- Aunchan POS — 011_reports.sql
-- รายงานสำหรับเจ้าของร้าน (§5 หน้า 11)
-- concern เดียว: การรวมยอดเพื่อออกรายงาน
-- รันซ้ำได้อย่างปลอดภัย
-- =====================================================================
--
-- ทำไมต้องอยู่ฝั่งฐานข้อมูล: §7.3 ห้ามคำนวณเงินฝั่งเบราว์เซอร์
-- หน้ารายงานจึงห้ามดึงบิลมาบวกเอง ต้องอ่านยอดที่รวมมาแล้วจากที่นี่
-- ทุกตัวในไฟล์นี้เป็นสิทธิ์ owner เท่านั้น เพราะมีต้นทุนและกำไรอยู่ด้วย
-- (RLS ของ products/sale_items กันอีกชั้นหนึ่งอยู่แล้ว ที่นี่กันซ้ำด้วย is_owner())
--
-- นิยามเดียวกับ sales_daily_summary ใน 008:
--   ไม่นับบิลที่ยกเลิก · คิดตามจำนวนสุทธิ (quantity - returned_qty)
--   net_revenue ยังไม่หักส่วนลดกดมือ เพราะตอนปิดบิลไม่ได้เฉลี่ยส่วนลดนั้นลงรายการ
-- =====================================================================

-- ---------------------------------------------------------------------
-- report_product_sales — ยอดขายรายสินค้าในช่วงวันที่ (เรียงยอดขายมากไปน้อย)
--   input : p_from date, p_to date  (ตามเวลาหน้าร้าน Asia/Bangkok)
--   สิทธิ์ : owner — คนอื่นเรียกได้แต่จะได้ 0 แถว
-- ---------------------------------------------------------------------
create or replace function public.report_product_sales(p_from date, p_to date)
returns table (
  product_id   uuid,
  sku          text,
  name         text,
  category     text,
  qty_sold     integer,
  net_revenue  numeric,
  net_cost     numeric,
  gross_profit numeric
)
language sql
stable
as $$
  select
    p.id,
    p.sku::text,
    p.name::text,
    p.category::text,
    sum(si.quantity - si.returned_qty)::integer,
    public.round_half_up(
      sum(si.line_total_excl_vat * (si.quantity - si.returned_qty)::numeric / si.quantity), 2),
    public.round_half_up(sum(si.unit_cost * (si.quantity - si.returned_qty)), 2),
    public.round_half_up(
      sum(si.line_total_excl_vat * (si.quantity - si.returned_qty)::numeric / si.quantity)
      - sum(si.unit_cost * (si.quantity - si.returned_qty)), 2)
  from public.sale_items si
  join public.sales s    on s.id = si.sale_id
  join public.products p on p.id = si.product_id
  where s.status <> 'voided'
    and public.is_owner()
    and (s.created_at at time zone 'Asia/Bangkok')::date between p_from and p_to
  group by p.id, p.sku, p.name, p.category
  order by 6 desc, 2;
$$;

revoke all on function public.report_product_sales(date, date) from public, anon;
grant execute on function public.report_product_sales(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- stock_value_report — มูลค่าสต็อกคงเหลือ ณ ปัจจุบัน (ราคาทุนถัวเฉลี่ย)
-- security_invoker = true → RLS ของ products มีผล staff จึงอ่านไม่ได้อยู่แล้ว
-- ---------------------------------------------------------------------
drop view if exists public.stock_value_report;
create view public.stock_value_report
with (security_invoker = true) as
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.category,
    p.unit,
    inv.quantity,
    inv.reorder_point,
    p.cost_price,
    p.price,
    public.round_half_up(inv.quantity * p.cost_price, 2) as stock_value
  from public.products p
  join public.inventory inv on inv.product_id = p.id
  where p.is_active
    and public.is_owner();

revoke all on public.stock_value_report from public, anon;
grant select on public.stock_value_report to authenticated;

-- ---------------------------------------------------------------------
-- stock_value_summary — บรรทัดสรุปของรายงานมูลค่าสต็อก (แถวเดียว)
-- มีเพื่อไม่ให้หน้าเว็บต้องบวกยอดรวมเอง (§7.3)
-- ---------------------------------------------------------------------
drop view if exists public.stock_value_summary;
create view public.stock_value_summary
with (security_invoker = true) as
  select
    count(*)::integer                                       as product_count,
    coalesce(sum(r.quantity), 0)::integer                   as total_quantity,
    public.round_half_up(coalesce(sum(r.stock_value), 0), 2) as total_value,
    count(*) filter (where r.quantity <= r.reorder_point)::integer as low_stock_count
  from public.stock_value_report r;

revoke all on public.stock_value_summary from public, anon;
grant select on public.stock_value_summary to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
begin
  if to_regprocedure('public.report_product_sales(date,date)') is null then
    raise exception '011_reports: สร้าง report_product_sales ไม่สำเร็จ';
  end if;

  if to_regclass('public.stock_value_report') is null
     or to_regclass('public.stock_value_summary') is null then
    raise exception '011_reports: สร้าง view ไม่ครบ';
  end if;

  raise notice '011_reports: สร้าง report_product_sales, stock_value_report และ stock_value_summary แล้ว';
end $$;

-- ตัวอย่าง: สินค้าขายดี 10 อันดับของ 30 วันล่าสุด
select *
from public.report_product_sales(
  (now() at time zone 'Asia/Bangkok')::date - 29,
  (now() at time zone 'Asia/Bangkok')::date)
limit 10;
