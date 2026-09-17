// =====================================================================
// settings.api.ts — ค่าตั้งค่าร้าน (ชื่อร้าน ที่อยู่ เลขผู้เสียภาษี อัตรา VAT พร้อมเพย์)
// ใช้บนหัวใบเสร็จและสร้าง QR พร้อมเพย์
// =====================================================================
import { supabase } from "../lib/supabase";
import type { StoreSettings } from "../types/db";

export async function getStoreSettings(): Promise<StoreSettings | null> {
  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data as StoreSettings | null;
}
