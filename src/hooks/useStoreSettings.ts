// =====================================================================
// useStoreSettings — ค่าตั้งค่าร้านสำหรับหัวใบเสร็จและอัตรา VAT ที่ใช้ประมาณการบนจอ
// อัตราจริงที่บันทึกลงบิลมาจากฝั่งเซิร์ฟเวอร์เสมอ (sales.vat_rate)
// =====================================================================
import { useEffect, useState } from "react";
import { getStoreSettings } from "../api/settings.api";
import type { StoreSettings } from "../types/db";

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getStoreSettings()
      .then((data) => {
        if (active) setSettings(data);
      })
      .catch(() => {
        if (active) setSettings(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { settings, loading };
}
