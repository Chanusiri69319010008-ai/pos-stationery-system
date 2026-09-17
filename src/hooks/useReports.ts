// =====================================================================
// useReports — หน้ารายงาน (owner เท่านั้น) (§5 หน้า 11)
// เก็บช่วงวันที่ที่เลือก แล้วดึงยอดที่รวมมาแล้วจากฐานข้อมูล
// ห้ามบวกเลขเองใน hook นี้ (§7.3)
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import {
  getStockValueSummary,
  listDailySummaryRange,
  listStockValueReport,
  reportProductSales,
  type DailySummary,
  type ProductSalesRow,
  type StockValueRow,
  type StockValueSummary,
} from "../api/reports.api";
import { todayInBangkok } from "../lib/datetime";

/** ย้อนหลัง n วันจากวันนี้ตามเวลาหน้าร้าน */
function daysAgoInBangkok(days: number): string {
  const today = new Date(`${todayInBangkok()}T00:00:00+07:00`);
  today.setDate(today.getDate() - days);
  return today.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function useReports() {
  const [from, setFrom] = useState(daysAgoInBangkok(29));
  const [to, setTo] = useState(todayInBangkok());

  const [daily, setDaily] = useState<DailySummary[]>([]);
  const [products, setProducts] = useState<ProductSalesRow[]>([]);
  const [stock, setStock] = useState<StockValueRow[]>([]);
  const [stockSummary, setStockSummary] = useState<StockValueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [dailyRows, productRows, stockRows, summary] = await Promise.all([
        listDailySummaryRange(from, to),
        reportProductSales(from, to),
        listStockValueReport(),
        getStockValueSummary(),
      ]);

      setDaily(dailyRows);
      setProducts(productRows);
      setStock(stockRows);
      setStockSummary(summary);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    from,
    to,
    setFrom,
    setTo,
    daily,
    products,
    stock,
    stockSummary,
    loading,
    error,
    refresh,
  };
}
