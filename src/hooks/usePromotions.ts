// =====================================================================
// usePromotions — รายการโปรโมชั่นสำหรับหน้าจัดการโปรโมชั่น (§5 หน้า 8)
// เรียก api/ อย่างเดียว ไม่คิดส่วนลดเอง — ส่วนลดจริงคิดที่ checkout_sale
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { listPromotions, type PromotionWithProduct } from "../api/promotions.api";
import { todayInBangkok } from "../lib/datetime";

export function usePromotions() {
  const [promotions, setPromotions] = useState<PromotionWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPromotions(await listPromotions());
      setError(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? "โหลดรายการโปรโมชั่นไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // เงื่อนไขเดียวกับที่ checkout_sale ใช้คัดโปร: is_active และวันนี้อยู่ในช่วงวันที่
  const runningCount = useMemo(() => {
    const today = todayInBangkok();
    return promotions.filter(
      (promo) => promo.is_active && promo.start_date <= today && today <= promo.end_date,
    ).length;
  }, [promotions]);

  return { promotions, runningCount, loading, error, refresh };
}
