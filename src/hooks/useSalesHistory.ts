// =====================================================================
// useSalesHistory — ประวัติการขาย พร้อมตัวกรองและแบ่งหน้า (§5 หน้า 3)
// owner เห็นทั้งร้าน / staff เห็นเฉพาะรอบขายของตัวเอง — บังคับด้วย RLS ไม่ใช่ที่นี่
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { listSales, type SaleListRow, type SalesFilter } from "../api/reports.api";

const PAGE_SIZE = 20;

export function useSalesHistory() {
  const [filter, setFilter] = useState<SalesFilter>({ page: 1, pageSize: PAGE_SIZE });
  const [rows, setRows] = useState<SaleListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSales(filter);
      setRows(result.rows);
      setTotal(result.total);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดประวัติการขายไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** เปลี่ยนตัวกรองแล้วกลับไปหน้าแรกเสมอ */
  const applyFilter = useCallback((next: Omit<SalesFilter, "page" | "pageSize">) => {
    setFilter({ ...next, page: 1, pageSize: PAGE_SIZE });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilter((current) => ({ ...current, page }));
  }, []);

  const page = filter.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { rows, total, page, pageCount, loading, error, filter, applyFilter, goToPage, refresh };
}
