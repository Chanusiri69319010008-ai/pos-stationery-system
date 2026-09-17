// =====================================================================
// useDashboard — ข้อมูลหน้า Dashboard (owner เท่านั้น) (§5 หน้า 5)
// ยอดทุกตัวมาจาก view sales_daily_summary ที่รวมมาแล้วฝั่งเซิร์ฟเวอร์
// hook นี้ทำได้แค่เลือกแถวมาแสดง ห้ามบวกเลขเอง (§7.3)
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDailySummary,
  listLowStockProducts,
  type DailySummary,
  type LowStockProduct,
} from "../api/reports.api";
import { todayInBangkok } from "../lib/datetime";

export function useDashboard(days = 7) {
  const [daily, setDaily] = useState<DailySummary[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, low] = await Promise.all([
        listDailySummary(days),
        listLowStockProducts(),
      ]);
      setDaily(summary);
      setLowStock(low);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดข้อมูล Dashboard ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // เลือกแถวของวันนี้มาแสดง ไม่ได้คำนวณอะไรใหม่
  const today = useMemo(
    () => daily.find((row) => row.sale_date === todayInBangkok()) ?? null,
    [daily],
  );

  return { daily, today, lowStock, loading, error, refresh };
}
