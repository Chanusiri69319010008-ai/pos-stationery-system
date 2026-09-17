-- =====================================================================
-- Aunchan POS — 008_views_dashboard.sql
-- view สำหรับ Dashboard และประวัติการขาย (§5 หน้า 3, 5)
-- concern เดียว: การรวมยอดฝั่งเซิร์ฟเวอร์
-- รันซ้ำได้อย่างปลอดภัย
-- =====================================================================
--
-- ทำไมต้องเป็น view: §7.3 ห้ามคำนวณตัวเลขเงินฝั่งเบราว์เซอร์
-- หน้า Dashboard จึงห้ามดึงบิลมาบวกเองใน React — ต้องอ่านยอดที่รวมมาแล้วจากที่นี่
--
-- security_invoker = true → RLS ของ sales/sale_items มีผลกับผู้เรียก
-- และบังคับ is_owner() ซ้ำอีกชั้นในตัว view เพราะ §5 ให้กำไรขั้นต้นเป็นสิทธิ์ owner
-- เท่านั้น staff เรียก view นี้จะได้ 0 แถวเสมอ ไม่ใช่ยอดของตัวเอง
--
-- นิยามกำไรขั้นต้นตาม §4:
--   กำไร = SUM(line_total_excl_vat) - SUM(unit_cost * quantity)
--   นับเฉพาะบิล status <> 'voided' และ "หักส่วนที่คืนแล้ว"
--   จึงคิดตามจำนวนสุทธิ (quantity - returned_qty) ทั้งฝั่งรายได้และฝั่งต้นทุน
--
-- ยอดขาย 3 ตัวที่ต้องไม่สับสนกัน:
--   total_sales  = ยอดที่ออกบิลไปในวันนั้น (บิลที่ยกเลิกไม่นับ)
--   refund_total = เงินที่คืนลูกค้าของบิลวันนั้น (นับตามวันที่ "ขาย" ไม่ใช่วันที่คืน
--                  เพื่อให้ทุกคอลัมน์ในแถวเดียวกันพูดถึงบิลชุดเดียวกัน)
--   net_sales    = total_sales - refund_total = เงินที่ร้านได้จริงจากบิลของวันนั้น
--   Dashboard แสดง net_sales เป็น "ยอดขาย" เพราะเป็นตัวที่สอดคล้องกับ gross_profit
--   ซึ่งหักของที่คืนแล้วอยู่ก่อนหน้านี้
-- =====================================================================

drop view if exists public.sales_daily_summary;
create view public.sales_daily_summary
with (security_invoker = true) as
with bill as (
  select
    (s.created_at at time zone 'Asia/Bangkok')::date as sale_date,
    s.id,
    s.subtotal,
    s.bill_discount,
    s.manual_discount,
    s.vat_amount,
    s.total_amount
  from public.sales s
  where s.status <> 'voided'
    and public.is_owner()
),
item as (
  select
    (s.created_at at time zone 'Asia/Bangkok')::date as sale_date,
    sum(si.line_total_excl_vat * (si.quantity - si.returned_qty)::numeric / si.quantity) as net_revenue,
    sum(si.unit_cost * (si.quantity - si.returned_qty))                                  as net_cost
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.status <> 'voided'
    and public.is_owner()
  group by 1
),
refund as (
  select
    (s.created_at at time zone 'Asia/Bangkok')::date as sale_date,
    sum(r.refund_amount)                             as refund_total
  from public.returns r
  join public.sales s on s.id = r.sale_id
  where s.status <> 'voided'
    and public.is_owner()
  group by 1
)
select
  b.sale_date,
  count(*)::integer                                             as bill_count,
  sum(b.total_amount)                                           as total_sales,
  public.round_half_up(coalesce(max(f.refund_total), 0), 2)     as refund_total,
  public.round_half_up(
    sum(b.total_amount) - coalesce(max(f.refund_total), 0), 2)  as net_sales,
  sum(b.subtotal)                                               as subtotal_total,
  sum(b.vat_amount)                                             as vat_total,
  sum(b.bill_discount + b.manual_discount)                      as discount_total,
  public.round_half_up(coalesce(max(i.net_revenue), 0), 2)      as net_revenue,
  public.round_half_up(coalesce(max(i.net_cost), 0), 2)         as net_cost,
  public.round_half_up(
    coalesce(max(i.net_revenue), 0) - coalesce(max(i.net_cost), 0), 2)
                                                                as gross_profit
from bill b
left join item   i on i.sale_date = b.sale_date
left join refund f on f.sale_date = b.sale_date
group by b.sale_date;

revoke all on public.sales_daily_summary from public, anon;
grant select on public.sales_daily_summary to authenticated;

-- ---------------------------------------------------------------------
-- สินค้าที่ถึงจุดสั่งซื้อ — quantity <= reorder_point (เท่ากันนับด้วย) §4
-- ไม่มีคอลัมน์ต้นทุน staff จึงเปิดดูได้ด้วย
-- ---------------------------------------------------------------------
drop view if exists public.low_stock_products;
create view public.low_stock_products as
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.category,
    p.unit,
    inv.quantity,
    inv.reorder_point
  from public.products p
  join public.inventory inv on inv.product_id = p.id
  where p.is_active
    and inv.quantity <= inv.reorder_point;

revoke all on public.low_stock_products from public, anon;
grant select on public.low_stock_products to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
begin
  if to_regclass('public.sales_daily_summary') is null
     or to_regclass('public.low_stock_products') is null then
    raise exception '008_views_dashboard: สร้าง view ไม่ครบ';
  end if;

  raise notice '008_views_dashboard: สร้าง sales_daily_summary และ low_stock_products แล้ว';
end $$;

-- ตัวอย่างข้อมูล 7 วันล่าสุด (รันเพื่อดูผลได้ทันที)
select *
from public.sales_daily_summary
order by sale_date desc
limit 7;
