// =====================================================================
// suppliers.api.ts — ซัพพลายเออร์ (§5 หน้า 10)
// อ่านได้ทั้ง owner และ staff (ใช้ตอนรับสินค้าเข้า) แต่เขียนได้เฉพาะ owner ตาม RLS
// ห้ามมี logic ธุรกิจในไฟล์นี้ (การนับจำนวนสินค้าต่อซัพพลายเออร์เป็นการรวมข้อมูล
// เพื่อแสดงผล ไม่ใช่การคิดเงิน)
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Supplier, Uuid } from "../types/db";

export async function listSuppliers(activeOnly = true): Promise<Supplier[]> {
  let query = supabase.from("suppliers").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export type SupplierWithUsage = Supplier & { product_count: number };

/** ซัพพลายเออร์ทั้งหมด + จำนวนสินค้าที่ผูกไว้ — ใช้เตือนก่อนปิดการใช้งาน */
export async function listSuppliersWithUsage(): Promise<SupplierWithUsage[]> {
  const [{ data: suppliers, error: sErr }, { data: products, error: pErr }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("products_for_staff").select("supplier_id"),
  ]);

  if (sErr) throw sErr;
  if (pErr) throw pErr;

  const countBySupplier = new Map<Uuid, number>();
  for (const row of products ?? []) {
    if (row.supplier_id) {
      countBySupplier.set(row.supplier_id, (countBySupplier.get(row.supplier_id) ?? 0) + 1);
    }
  }

  return (suppliers ?? []).map((supplier: Supplier) => ({
    ...supplier,
    product_count: countBySupplier.get(supplier.id) ?? 0,
  }));
}

export type SupplierInput = {
  name: string;
  contact: string | null;
  email: string | null;
  note: string | null;
};

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id: Uuid, input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** ปิด/เปิดการใช้งาน — ไม่มีการลบ เพราะ products และ stock_movements อ้างถึงอยู่ (§4) */
export async function setSupplierActive(id: Uuid, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("suppliers").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}
