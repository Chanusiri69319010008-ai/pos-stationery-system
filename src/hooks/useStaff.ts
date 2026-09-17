// =====================================================================
// useStaff — หน้าจัดการพนักงาน (§5 หน้า 12)
// เรียก api/ อย่างเดียว
// =====================================================================
import { useCallback, useEffect, useState } from "react";
import { listStaff, listUnlinkedAuthUsers, type UnlinkedAuthUser } from "../api/staff.api";
import type { Staff } from "../types/db";

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedAuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, pending] = await Promise.all([listStaff(), listUnlinkedAuthUsers()]);
      setStaff(rows);
      setUnlinked(pending);
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดรายชื่อพนักงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { staff, unlinked, loading, error, refresh };
}
