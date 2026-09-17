// =====================================================================
// Supabase client — จุดเดียวของทั้งโปรเจกต์ (§1)
// ห้ามสร้าง createClient ที่ไฟล์อื่น และห้ามใส่ service_role key ที่นี่
// =====================================================================
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false เมื่อยังไม่ได้ตั้งค่า .env.local — App จะแสดงหน้าบอกวิธีตั้งค่าแทนจอขาว */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url ?? "https://not-configured.supabase.co",
  anonKey ?? "not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * client ชั่วคราวสำหรับ "สร้างบัญชีพนักงานใหม่" ในหน้าจัดการพนักงาน (§5 หน้า 12)
 * ใช้คีย์เดียวกับ client หลักทุกประการ ต่างกันแค่ไม่เก็บ session ลงเบราว์เซอร์
 * เพื่อไม่ให้การสมัครบัญชีใหม่ไปเตะเจ้าของร้านออกจากระบบ
 * ใช้ได้เฉพาะ auth.signUp เท่านั้น ห้ามเอาไปอ่าน/เขียนข้อมูลในตาราง
 */
export function createSignUpClient() {
  return createClient(url ?? "https://not-configured.supabase.co", anonKey ?? "not-configured", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** แปลง error จาก Supabase เป็นข้อความภาษาไทยที่ผู้ใช้อ่านรู้เรื่อง */
export function errorMessage(error: unknown): string {
  if (!error) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  if (typeof error === "string") return error;

  const e = error as { message?: string; hint?: string; details?: string };
  const raw = e.message ?? e.details ?? e.hint ?? "";

  if (raw.includes("Invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (raw.includes("Email not confirmed")) return "อีเมลนี้ยังไม่ได้ยืนยัน";
  if (raw.includes("Failed to fetch")) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต";

  return raw || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}
