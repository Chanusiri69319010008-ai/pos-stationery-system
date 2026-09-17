// =====================================================================
// returns.api.ts — เรียก RPC create_return และ void_sale (§7.8)
// ห้ามคำนวณเงินคืนในไฟล์นี้ ยอดทุกตัวมาจากฐานข้อมูล (§7.3)
// =====================================================================
import { supabase } from "../lib/supabase";
import type { Return, ReturnItem, ReturnItemInput, ReturnResult, Sale, Uuid } from "../types/db";

/** รับคืนสินค้าบางส่วนหรือทั้งบิล — owner เท่านั้น (ฐานข้อมูลเป็นผู้บังคับ) */
export async function createReturn(
  saleId: Uuid,
  items: ReturnItemInput[],
  reason: string,
): Promise<ReturnResult> {
  const { data, error } = await supabase.rpc("create_return", {
    p_sale_id: saleId,
    p_items: items,
    p_reason: reason,
  });

  if (error) throw error;
  return data as ReturnResult;
}

/** ยกเลิกบิลทั้งใบ คืนของเข้าสต็อกทุกชิ้น — owner เท่านั้น */
export async function voidSale(saleId: Uuid, reason: string): Promise<Sale> {
  const { data, error } = await supabase.rpc("void_sale", {
    p_sale_id: saleId,
    p_reason: reason,
  });

  if (error) throw error;
  return data as Sale;
}

/** ค้นหาบิลจากเลขที่บิล เพื่อเปิดหน้าคืนสินค้า */
export async function findSaleByReceiptNo(receiptNo: string): Promise<Sale | null> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("receipt_no", receiptNo)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type ReturnWithItems = Return & { return_items: ReturnItem[] };

/** ประวัติการคืนของบิลหนึ่ง — ใช้แสดงว่าคืนอะไรไปแล้วบ้าง */
export async function listReturnsOfSale(saleId: Uuid): Promise<ReturnWithItems[]> {
  const { data: returns, error } = await supabase
    .from("returns")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!returns || returns.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("return_items")
    .select("*")
    .in(
      "return_id",
      returns.map((r) => r.id),
    );

  if (itemsError) throw itemsError;

  return returns.map((r: Return) => ({
    ...r,
    return_items: (items ?? []).filter((item: ReturnItem) => item.return_id === r.id),
  }));
}
