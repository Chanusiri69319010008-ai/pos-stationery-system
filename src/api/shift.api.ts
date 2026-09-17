// =====================================================================
// shift.api.ts — RPC open_shift / close_shift และการอ่านรอบขาย
// ห้ามคำนวณยอดในไฟล์นี้ ยอดสรุปมาจาก view shift_summary ฝั่งเซิร์ฟเวอร์
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Shift, ShiftSummary, Uuid } from "../types/db";

/** รอบขายที่ยังไม่ปิดของผู้ใช้ที่ล็อกอินอยู่ (RLS ยอมให้เห็นเฉพาะของตัวเอง) */
export async function getOpenShift(staffId: Uuid): Promise<Shift | null> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("staff_id", staffId)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Shift | null;
}

export async function openShift(openingCash: number): Promise<Shift> {
  const { data, error } = await supabase.rpc("open_shift", { p_opening_cash: openingCash });
  if (error) throw error;
  return data as Shift;
}

export async function closeShift(shiftId: Uuid, countedCash: number): Promise<Shift> {
  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_counted_cash: countedCash,
  });

  if (error) throw error;
  return data as Shift;
}

/** ยอดสรุปของรอบขายแยกช่องทาง — คำนวณฝั่งเซิร์ฟเวอร์ทั้งหมด */
export async function getShiftSummary(shiftId: Uuid): Promise<ShiftSummary | null> {
  const { data, error } = await supabase
    .from("shift_summary")
    .select("*")
    .eq("shift_id", shiftId)
    .maybeSingle();

  if (error) throw error;
  return data as ShiftSummary | null;
}

/** ประวัติรอบขายล่าสุด (owner เห็นทุกคน / staff เห็นของตัวเอง ตาม RLS) */
export async function listRecentShifts(limit = 10): Promise<ShiftSummary[]> {
  const { data, error } = await supabase
    .from("shift_summary")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ShiftSummary[];
}
