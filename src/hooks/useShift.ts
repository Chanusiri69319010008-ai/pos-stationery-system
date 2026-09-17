// =====================================================================
// useShift — สถานะรอบขายของผู้ใช้ที่ล็อกอินอยู่
// ไม่คำนวณตัวเลขเอง ทุกค่ามาจาก RPC และ view shift_summary
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { closeShift, getOpenShift, getShiftSummary, openShift } from "../api/shift.api";
import { useAuth } from "./useAuth";
import type { Shift, ShiftSummary } from "../types/db";

export function useShift() {
  const { staff } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!staff) {
      setShift(null);
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const current = await getOpenShift(staff.id);
      setShift(current);
      setSummary(current ? await getShiftSummary(current.id) : null);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดรอบขายไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(
    async (openingCash: number) => {
      const created = await openShift(openingCash);
      setShift(created);
      setSummary(await getShiftSummary(created.id));
      return created;
    },
    [],
  );

  const close = useCallback(
    async (shiftId: string, countedCash: number) => {
      const closed = await closeShift(shiftId, countedCash);
      setShift(null);
      setSummary(await getShiftSummary(closed.id));
      return closed;
    },
    [],
  );

  return { shift, summary, loading, error, refresh, open, close };
}
