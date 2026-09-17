// =====================================================================
// useProducts — รายการสินค้า + ยอดคงเหลือ สำหรับหน้าขาย หน้าสินค้า และหน้าดูสต็อก
// เรียก api/ อย่างเดียว ไม่คำนวณตัวเลขเอง
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { listProductsForOwner, listProductsWithStock } from "../api/products.api";
import { useAuth } from "./useAuth";
import type { ProductWithStock } from "../types/db";

type Options = {
  /** true = อ่านจากตาราง products เพื่อให้ได้คอลัมน์ต้นทุน (owner เท่านั้น) */
  withCost?: boolean;
  /** true = เอาเฉพาะสินค้าที่เปิดขายอยู่ */
  activeOnly?: boolean;
};

export function useProducts({ withCost = false, activeOnly = false }: Options = {}) {
  const { isOwner } = useAuth();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = withCost && isOwner ? await listProductsForOwner() : await listProductsWithStock();
      setProducts(activeOnly ? rows.filter((p) => p.is_active) : rows);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดรายการสินค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [withCost, isOwner, activeOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  );

  const lowStock = useMemo(
    // §4 นิยาม "ถึงจุดสั่งซื้อ": quantity <= reorder_point (เท่ากันนับด้วย)
    () => products.filter((p) => p.is_active && p.quantity <= p.reorder_point),
    [products],
  );

  return { products, categories, lowStock, loading, error, refresh };
}
