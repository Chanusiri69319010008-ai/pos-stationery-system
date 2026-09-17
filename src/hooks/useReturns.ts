// =====================================================================
// useReturns — หน้าคืนสินค้า/ยกเลิกบิล (§5 หน้า 9)
// โหลดบิลจากเลขที่บิล แล้วส่งคำสั่งไป RPC
// ไม่คิดเงินคืนเอง ยอดที่แสดงหลังทำรายการมาจาก create_return ทั้งหมด (§7.3)
// =====================================================================
import { useCallback, useState } from "react";
import { getSaleWithItems } from "../api/sales.api";
import {
  createReturn,
  findSaleByReceiptNo,
  listReturnsOfSale,
  voidSale,
  type ReturnWithItems,
} from "../api/returns.api";
import { errorMessage } from "../lib/supabase";
import type { ReturnItemInput, ReturnResult, SaleWithItems, Uuid } from "../types/db";

export function useReturns() {
  const [sale, setSale] = useState<SaleWithItems | null>(null);
  const [history, setHistory] = useState<ReturnWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadById = useCallback(async (saleId: Uuid) => {
    setLoading(true);
    try {
      const [found, returns] = await Promise.all([
        getSaleWithItems(saleId),
        listReturnsOfSale(saleId),
      ]);
      setSale(found);
      setHistory(returns);
      setError(found ? null : "ไม่พบบิลที่ระบุ");
    } catch (e) {
      setSale(null);
      setHistory([]);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  /** ค้นหาด้วยเลขที่บิล เช่น INV-2026-000012 */
  const search = useCallback(
    async (receiptNo: string) => {
      setLoading(true);
      try {
        const found = await findSaleByReceiptNo(receiptNo.trim());
        if (!found) {
          setSale(null);
          setHistory([]);
          setError(`ไม่พบบิลเลขที่ ${receiptNo.trim()}`);
          return;
        }
        await loadById(found.id);
      } catch (e) {
        setSale(null);
        setHistory([]);
        setError(errorMessage(e));
        setLoading(false);
      }
    },
    [loadById],
  );

  const clear = useCallback(() => {
    setSale(null);
    setHistory([]);
    setError(null);
  }, []);

  /** ส่งใบคืน — ผลลัพธ์ที่ส่งกลับคือยอดจริงจากฐานข้อมูล */
  const submitReturn = useCallback(
    async (items: ReturnItemInput[], reason: string): Promise<ReturnResult> => {
      if (!sale) throw new Error("ยังไม่ได้เลือกบิล");
      const result = await createReturn(sale.id, items, reason);
      await loadById(sale.id);
      return result;
    },
    [sale, loadById],
  );

  const submitVoid = useCallback(
    async (reason: string) => {
      if (!sale) throw new Error("ยังไม่ได้เลือกบิล");
      const result = await voidSale(sale.id, reason);
      await loadById(sale.id);
      return result;
    },
    [sale, loadById],
  );

  return { sale, history, loading, error, search, loadById, clear, submitReturn, submitVoid };
}
