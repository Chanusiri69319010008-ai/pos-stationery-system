// =====================================================================
// useSuppliers — รายชื่อซัพพลายเออร์สำหรับหน้าจัดการซัพพลายเออร์ (§5 หน้า 10)
// เรียก api/ อย่างเดียว ไม่คำนวณอะไรเอง
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import {
  listSuppliers,
  listSuppliersWithUsage,
  type SupplierWithUsage,
} from "../api/suppliers.api";

type Options = {
  /** true = นับจำนวนสินค้าที่ผูกไว้ด้วย (หน้าจัดการซัพพลายเออร์) */
  withUsage?: boolean;
  /** true = เอาเฉพาะรายที่ยังใช้งานอยู่ (ช่องเลือกในฟอร์มอื่น) */
  activeOnly?: boolean;
};

export function useSuppliers({ withUsage = true, activeOnly = false }: Options = {}) {
  const [suppliers, setSuppliers] = useState<SupplierWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = withUsage
        ? await listSuppliersWithUsage()
        : (await listSuppliers(activeOnly)).map((s) => ({ ...s, product_count: 0 }));

      setSuppliers(activeOnly ? rows.filter((s) => s.is_active) : rows);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดรายชื่อซัพพลายเออร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [withUsage, activeOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { suppliers, loading, error, refresh };
}
