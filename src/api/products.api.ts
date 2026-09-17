// =====================================================================
// products.api.ts — เรียก .from() ของตาราง products / products_for_staff / inventory
// ห้ามมี logic คำนวณเงินหรือสต็อกในไฟล์นี้ (การรวมสองชุดข้อมูลเข้าด้วยกันไม่ใช่การคำนวณ)
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Inventory, Product, ProductForStaff, ProductWithStock, Uuid } from "../types/db";

/** สินค้าทั้งหมดที่เปิดขาย + ยอดคงเหลือ (ใช้ได้ทั้ง owner และ staff — view ไม่มีคอลัมน์ต้นทุน) */
export async function listProductsWithStock(): Promise<ProductWithStock[]> {
  const [{ data: products, error: pErr }, { data: inventory, error: iErr }] = await Promise.all([
    supabase.from("products_for_staff").select("*").order("sku"),
    supabase.from("inventory").select("product_id, quantity, reorder_point, updated_at"),
  ]);

  if (pErr) throw pErr;
  if (iErr) throw iErr;

  const stockByProduct = new Map<Uuid, Pick<Inventory, "quantity" | "reorder_point">>(
    (inventory ?? []).map((row) => [row.product_id, row]),
  );

  return (products ?? []).map((p: ProductForStaff) => ({
    ...p,
    quantity: stockByProduct.get(p.id)?.quantity ?? 0,
    reorder_point: stockByProduct.get(p.id)?.reorder_point ?? 0,
  }));
}

/** สินค้าทั้งหมดพร้อมต้นทุน — owner เท่านั้น (RLS ปฏิเสธถ้าเรียกด้วยบัญชี staff) */
export async function listProductsForOwner(): Promise<ProductWithStock[]> {
  const [{ data: products, error: pErr }, { data: inventory, error: iErr }] = await Promise.all([
    supabase.from("products").select("*").order("sku"),
    supabase.from("inventory").select("product_id, quantity, reorder_point, updated_at"),
  ]);

  if (pErr) throw pErr;
  if (iErr) throw iErr;

  const stockByProduct = new Map<Uuid, Pick<Inventory, "quantity" | "reorder_point">>(
    (inventory ?? []).map((row) => [row.product_id, row]),
  );

  return (products ?? []).map((p: Product) => ({
    ...p,
    quantity: stockByProduct.get(p.id)?.quantity ?? 0,
    reorder_point: stockByProduct.get(p.id)?.reorder_point ?? 0,
  }));
}

/** ค้นหาสินค้าด้วยบาร์โค้ด (ช่องสแกนหน้าขาย) */
export async function findProductByBarcode(barcode: string): Promise<ProductForStaff | null> {
  const { data, error } = await supabase
    .from("products_for_staff")
    .select("*")
    .eq("barcode", barcode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** ค้นหาสินค้าด้วยรหัสสินค้า (SKU) */
export async function findProductBySku(sku: string): Promise<ProductForStaff | null> {
  const { data, error } = await supabase
    .from("products_for_staff")
    .select("*")
    .eq("sku", sku)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type ProductInput = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  barcode: string | null;
  supplier_id: Uuid | null;
  image_url: string | null;
  is_vat_exempt: boolean;
};

/** เพิ่มสินค้าใหม่ + สร้างแถว inventory (ยอดเริ่มต้น 0 รับของเข้าผ่าน receive_stock เท่านั้น) */
export async function createProduct(
  input: ProductInput,
  reorderPoint: number,
): Promise<Product> {
  const { data, error } = await supabase.from("products").insert(input).select("*").single();
  if (error) throw error;

  const { error: invError } = await supabase
    .from("inventory")
    .insert({ product_id: data.id, quantity: 0, reorder_point: reorderPoint });
  if (invError) throw invError;

  return data;
}

export async function updateProduct(id: Uuid, input: Partial<ProductInput>): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** แก้จุดสั่งซื้อ — ไม่แตะคอลัมน์ quantity (§7.1) */
export async function updateReorderPoint(productId: Uuid, reorderPoint: number): Promise<void> {
  const { error } = await supabase
    .from("inventory")
    .update({ reorder_point: reorderPoint })
    .eq("product_id", productId);

  if (error) throw error;
}

/** ปิด/เปิดการใช้งานสินค้า — ห้ามลบข้อมูลที่มีประวัติ (§4 ห้ามทำ ข้อ 4) */
export async function setProductActive(id: Uuid, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}
