// =====================================================================
// staff.api.ts — จัดการพนักงาน (§5 หน้า 12)
// owner เท่านั้นที่เขียนได้ตาม RLS (staff_owner_write)
//
// ข้อจำกัดที่ต้องรู้: staff.id ต้องเท่ากับ auth.users.id เสมอ เพราะ RLS ทุกข้อ
// เทียบกับ auth.uid() — การเพิ่มพนักงานจึงมี 2 ทาง
//   1. createStaffAccount: สมัครบัญชีใหม่ผ่าน auth signUp แล้วสร้างแถว staff ด้วย id ที่ได้
//   2. linkStaff: ผูกบัญชีที่เจ้าของร้านสร้างไว้แล้วใน Supabase Dashboard
// ทั้งสองทางไม่ใช้ service_role ในเบราว์เซอร์ (§1 ห้ามเด็ดขาด)
// =====================================================================
import { createSignUpClient, supabase } from "../lib/supabase";
import type { Staff, StaffRole, Timestamptz, Uuid } from "../types/db";

/**
 * โปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ — ใช้ใน useAuth เพื่ออ่าน role จากตาราง staff (§1)
 * ห้ามอ่าน role จาก user_metadata เพราะผู้ใช้แก้เองได้
 */
export async function getStaffProfile(userId: Uuid): Promise<Staff | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .order("role")
    .order("name");

  if (error) throw error;
  return (data ?? []) as Staff[];
}

export type UnlinkedAuthUser = {
  user_id: Uuid;
  email: string;
  created_at: Timestamptz;
};

/** บัญชีล็อกอินที่ยังไม่มีแถวในตาราง staff (owner เท่านั้น — คนอื่นได้ 0 แถว) */
export async function listUnlinkedAuthUsers(): Promise<UnlinkedAuthUser[]> {
  const { data, error } = await supabase.rpc("list_unlinked_auth_users");
  if (error) throw error;
  return (data ?? []) as UnlinkedAuthUser[];
}

export type StaffProfileInput = {
  name: string;
  role: StaffRole;
};

/** แก้ชื่อหรือสิทธิ์ของพนักงาน — ไม่แตะอีเมลเพราะอีเมลอยู่ที่ auth.users */
export async function updateStaffProfile(id: Uuid, input: StaffProfileInput): Promise<Staff> {
  const { data, error } = await supabase
    .from("staff")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** เปิด/ปิดการใช้งาน — ไม่มีการลบ เพราะบิลและ movement อ้างถึง staff_id (§4) */
export async function setStaffActive(id: Uuid, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("staff").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

/** ผูกบัญชีล็อกอินที่มีอยู่แล้วเข้ากับแถว staff ใหม่ */
export async function linkStaff(
  userId: Uuid,
  email: string,
  input: StaffProfileInput,
): Promise<Staff> {
  const { data, error } = await supabase
    .from("staff")
    .insert({ id: userId, email, name: input.name, role: input.role, is_active: true })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export type NewStaffAccount = {
  email: string;
  password: string;
  name: string;
  role: StaffRole;
};

/**
 * สมัครบัญชีใหม่ + สร้างแถว staff
 * ใช้ client ชั่วคราวที่ไม่เก็บ session เจ้าของร้านจึงไม่หลุดออกจากระบบ
 * ถ้าโปรเจกต์ตั้งให้ยืนยันอีเมลก่อน พนักงานต้องกดยืนยันในเมลก่อนจึงจะล็อกอินได้
 */
export async function createStaffAccount(input: NewStaffAccount): Promise<Staff> {
  const signUpClient = createSignUpClient();

  const { data, error } = await signUpClient.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });

  if (error) throw error;

  const userId = data.user?.id;
  if (!userId) {
    throw new Error(
      "สมัครบัญชีไม่สำเร็จ อีเมลนี้อาจถูกใช้ไปแล้ว ให้ใช้วิธีผูกบัญชีที่มีอยู่แทน",
    );
  }

  return linkStaff(userId, input.email.trim(), { name: input.name, role: input.role });
}
