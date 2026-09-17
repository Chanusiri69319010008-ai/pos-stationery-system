// =====================================================================
// useStockManage — state ของหน้าจัดการสต็อก/รับสินค้าเข้า (§5 หน้า 7)
// เรียก api/ อย่างเดียว ไม่คำนวณตัวเลขเอง ทุกค่าที่แสดงมาจาก RPC หรือฐานข้อมูล
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import {
  adjustStock,
  listMovements,
  receiveStock,
  recordWaste,
  type MovementFilter,
  type MovementRow,
  type ReceiveItem,
} from "../api/stock.api";
import { listSuppliers } from "../api/suppliers.api";
import type { Supplier, Uuid } from "../types/db";

export function useStockManage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MovementFilter>({ limit: 100 });

  const refreshMovements = useCallback(
    async (next?: MovementFilter) => {
      const applied = next ?? filter;
      setLoading(true);
      try {
        setMovements(await listMovements(applied));
        setError(null);
      } catch (e) {
        setError((e as { message?: string }).message ?? "โหลดรายการเคลื่อนไหวไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    let active = true;
    listSuppliers()
      .then((rows) => {
        if (active) setSuppliers(rows);
      })
      .catch(() => {
        if (active) setSuppliers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void refreshMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const receive = useCallback(
    async (supplierId: Uuid | null, items: ReceiveItem[]) => receiveStock(supplierId, items),
    [],
  );

  const adjust = useCallback(
    async (productId: Uuid, newQuantity: number, reason: string) =>
      adjustStock(productId, newQuantity, reason),
    [],
  );

  const waste = useCallback(
    async (productId: Uuid, quantity: number, reason: string) =>
      recordWaste(productId, quantity, reason),
    [],
  );

  return {
    suppliers,
    movements,
    loading,
    error,
    filter,
    setFilter,
    refreshMovements,
    receive,
    adjust,
    waste,
  };
}
