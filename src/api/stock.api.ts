// =====================================================================
// stock.api.ts — อ่านสต็อก รายการเคลื่อนไหว และเรียก RPC ที่เปลี่ยนสต็อก
// ห้ามแก้ inventory.quantity จากไฟล์นี้เด็ดขาด — ต้องผ่าน RPC เท่านั้น (§7.1)
// ห้ามคำนวณต้นทุนถัวเฉลี่ยที่นี่ — receive_stock คำนวณให้ฝั่งเซิร์ฟเวอร์ (§4)
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Money, MovementType, StockMovement, Uuid } from "../types/db";

export type StockRow = {
  product_id: Uuid;
  quantity: number;
  reorder_point: number;
  updated_at: string;
};

/** ยอดคงเหลือทุกสินค้า */
export async function listInventory(): Promise<StockRow[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, quantity, reorder_point, updated_at");

  if (error) throw error;
  return (data ?? []) as StockRow[];
}

// ---------------------------------------------------------------------
// รายการเคลื่อนไหว — owner เท่านั้นตาม RLS
// ---------------------------------------------------------------------

export type MovementRow = StockMovement & {
  products: { name: string; sku: string } | null;
  staff: { name: string } | null;
};

export type MovementFilter = {
  productId?: Uuid | null;
  type?: MovementType | null;
  limit?: number;
};

export async function listMovements({
  productId = null,
  type = null,
  limit = 100,
}: MovementFilter = {}): Promise<MovementRow[]> {
  let query = supabase
    .from("stock_movements")
    .select("*, products ( name, sku ), staff:staff_id ( name )")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (productId) query = query.eq("product_id", productId);
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MovementRow[];
}

export async function listMovementsByProduct(
  productId: Uuid,
  limit = 50,
): Promise<MovementRow[]> {
  return listMovements({ productId, limit });
}

// ---------------------------------------------------------------------
// RPC ที่เปลี่ยนสต็อก (owner เท่านั้น — ฐานข้อมูลเป็นคนบังคับ)
// ---------------------------------------------------------------------

export type ReceiveItem = {
  product_id: Uuid;
  quantity: number;
  unit_cost: number;
};

/** ผลลัพธ์จริงหลังรับเข้า ใช้แสดงใน toast — ห้ามคำนวณเองฝั่งเบราว์เซอร์ */
export type ReceiveResult = {
  product_id: Uuid;
  sku: string;
  name: string;
  received: number;
  quantity: number;
  cost_price: Money;
};

export async function receiveStock(
  supplierId: Uuid | null,
  items: ReceiveItem[],
): Promise<ReceiveResult[]> {
  const { data, error } = await supabase.rpc("receive_stock", {
    p_supplier_id: supplierId,
    p_items: items,
  });

  if (error) throw error;
  return (data ?? []) as ReceiveResult[];
}

export type AdjustResult = {
  product_id: Uuid;
  name: string;
  old_quantity: number;
  new_quantity: number;
  qty_change: number;
};

export async function adjustStock(
  productId: Uuid,
  newQuantity: number,
  reason: string,
): Promise<AdjustResult> {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_new_quantity: newQuantity,
    p_reason: reason,
  });

  if (error) throw error;
  return data as AdjustResult;
}

export type WasteResult = {
  product_id: Uuid;
  name: string;
  quantity_before: number;
  quantity_after: number;
  wasted: number;
};

export async function recordWaste(
  productId: Uuid,
  quantity: number,
  reason: string,
): Promise<WasteResult> {
  const { data, error } = await supabase.rpc("record_waste", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reason: reason,
  });

  if (error) throw error;
  return data as WasteResult;
}
