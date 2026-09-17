// =====================================================================
// reports.api.ts — ยอดรวมสำหรับ Dashboard และประวัติการขาย
// ทุกยอดในไฟล์นี้อ่านจาก view ที่รวมมาแล้วฝั่งเซิร์ฟเวอร์ (§7.3)
// ห้ามบวกเลขเองในไฟล์นี้หรือใน hook ที่เรียกไฟล์นี้
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Money, Sale, SaleStatus, Uuid } from "../types/db";

export type DailySummary = {
  sale_date: string;
  bill_count: number;
  /** ยอดที่ออกบิลไปในวันนั้น (บิลที่ยกเลิกไม่นับ) */
  total_sales: Money;
  /** เงินที่คืนลูกค้าของบิลวันนั้น */
  refund_total: Money;
  /** total_sales - refund_total = เงินที่ร้านได้จริง */
  net_sales: Money;
  subtotal_total: Money;
  vat_total: Money;
  discount_total: Money;
  net_revenue: Money;
  net_cost: Money;
  gross_profit: Money;
};

/** ยอดรายวันย้อนหลัง n วัน (เรียงจากเก่าไปใหม่เพื่อใช้วาดกราฟ) */
export async function listDailySummary(days = 7): Promise<DailySummary[]> {
  const { data, error } = await supabase
    .from("sales_daily_summary")
    .select("*")
    .order("sale_date", { ascending: false })
    .limit(days);

  if (error) throw error;
  return ((data ?? []) as DailySummary[]).slice().reverse();
}

/** ยอดรายวันตามช่วงวันที่ที่เลือก (หน้ารายงาน §5 หน้า 11) */
export async function listDailySummaryRange(from: string, to: string): Promise<DailySummary[]> {
  const { data, error } = await supabase
    .from("sales_daily_summary")
    .select("*")
    .gte("sale_date", from)
    .lte("sale_date", to)
    .order("sale_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailySummary[];
}

export type ProductSalesRow = {
  product_id: Uuid;
  sku: string;
  name: string;
  category: string;
  qty_sold: number;
  net_revenue: Money;
  net_cost: Money;
  gross_profit: Money;
};

/** ยอดขายรายสินค้าในช่วงวันที่ — รวมยอดฝั่งฐานข้อมูลทั้งหมด (owner เท่านั้น) */
export async function reportProductSales(from: string, to: string): Promise<ProductSalesRow[]> {
  const { data, error } = await supabase.rpc("report_product_sales", {
    p_from: from,
    p_to: to,
  });

  if (error) throw error;
  return (data ?? []) as ProductSalesRow[];
}

export type StockValueRow = {
  product_id: Uuid;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorder_point: number;
  cost_price: Money;
  price: Money;
  stock_value: Money;
};

export type StockValueSummary = {
  product_count: number;
  total_quantity: number;
  total_value: Money;
  low_stock_count: number;
};

export async function listStockValueReport(): Promise<StockValueRow[]> {
  const { data, error } = await supabase
    .from("stock_value_report")
    .select("*")
    .order("stock_value", { ascending: false });

  if (error) throw error;
  return (data ?? []) as StockValueRow[];
}

export async function getStockValueSummary(): Promise<StockValueSummary | null> {
  const { data, error } = await supabase.from("stock_value_summary").select("*").maybeSingle();
  if (error) throw error;
  return data as StockValueSummary | null;
}

export type LowStockProduct = {
  product_id: Uuid;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorder_point: number;
};

export async function listLowStockProducts(): Promise<LowStockProduct[]> {
  const { data, error } = await supabase
    .from("low_stock_products")
    .select("*")
    .order("quantity");

  if (error) throw error;
  return (data ?? []) as LowStockProduct[];
}

// ---------------------------------------------------------------------
// ประวัติการขาย — owner เห็นทั้งร้าน / staff เห็นเฉพาะรอบขายตัวเอง (บังคับด้วย RLS)
// ---------------------------------------------------------------------

export type SaleListRow = Sale & {
  staff: { name: string } | null;
};

export type SalesFilter = {
  /** วันที่เริ่ม (yyyy-mm-dd ตามเวลาหน้าร้าน) */
  from?: string | null;
  to?: string | null;
  receiptNo?: string | null;
  status?: SaleStatus | null;
  page?: number;
  pageSize?: number;
};

export type SalesPage = {
  rows: SaleListRow[];
  total: number;
};

export async function listSales({
  from = null,
  to = null,
  receiptNo = null,
  status = null,
  page = 1,
  pageSize = 20,
}: SalesFilter = {}): Promise<SalesPage> {
  const fromIndex = (page - 1) * pageSize;

  let query = supabase
    .from("sales")
    .select("*, staff:staff_id ( name )", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(fromIndex, fromIndex + pageSize - 1);

  // ช่วงวันคิดตามเวลาหน้าร้าน (UTC+7) แล้วแปลงเป็นช่วงเวลา UTC ของฐานข้อมูล
  if (from) query = query.gte("created_at", `${from}T00:00:00+07:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999+07:00`);
  if (receiptNo) query = query.ilike("receipt_no", `%${receiptNo}%`);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: (data ?? []) as SaleListRow[], total: count ?? 0 };
}
