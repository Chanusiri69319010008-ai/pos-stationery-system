// =====================================================================
// sales.api.ts — เรียก RPC checkout_sale และอ่านบิล
// ห้ามคำนวณเงินในไฟล์นี้ ตัวเลขทุกตัวมาจากฐานข้อมูล (§7.3)
// =====================================================================
import { supabase } from "../lib/supabase";
import type { CheckoutItem, PaymentMethod, Sale, SaleWithItems, Uuid } from "../types/db";

export type CheckoutParams = {
  /** สร้างด้วย crypto.randomUUID() ก่อนกดยืนยัน เพื่อกันบิลซ้ำ (§7.6) */
  client_uuid: Uuid;
  shift_id: Uuid;
  items: CheckoutItem[];
  payment_method: PaymentMethod;
  cash_received: number | null;
  /** owner เท่านั้น — staff ส่งค่ามากกว่า 0 จะถูกฐานข้อมูลปฏิเสธ */
  manual_discount: number;
};

/** ปิดบิล — ธุรกรรมเดียวฝั่งฐานข้อมูล ส่งกลับแถว sales ที่บันทึกจริง */
export async function checkoutSale(params: CheckoutParams): Promise<Sale> {
  const { data, error } = await supabase.rpc("checkout_sale", {
    p_client_uuid: params.client_uuid,
    p_shift_id: params.shift_id,
    p_items: params.items,
    p_payment_method: params.payment_method,
    p_cash_received: params.cash_received,
    p_manual_discount: params.manual_discount,
  });

  if (error) throw error;
  return data as Sale;
}

/**
 * บิลพร้อมรายการสำหรับหน้าใบเสร็จ
 * อ่านผ่าน view ทั้งสองตัว ไม่ใช่ตารางจริง เพราะตาราง products และ sale_items
 * มีคอลัมน์ต้นทุนซึ่ง §2 ห้าม staff เห็น — view ตัดคอลัมน์นั้นออกไปแล้ว
 * ใบเสร็จไม่ต้องใช้ต้นทุน owner จึงอ่าน view เดียวกันได้
 */
export async function getSaleWithItems(saleId: Uuid): Promise<SaleWithItems | null> {
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .maybeSingle();

  if (saleError) throw saleError;
  if (!sale) return null;

  const { data: items, error: itemsError } = await supabase
    .from("sale_items_for_staff")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });

  if (itemsError) throw itemsError;

  const productIds = Array.from(new Set((items ?? []).map((item) => item.product_id)));

  const productById = new Map<Uuid, { id: Uuid; name: string; sku: string; unit: string }>();
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products_for_staff")
      .select("id, name, sku, unit")
      .in("id", productIds);

    if (productsError) throw productsError;
    for (const product of products ?? []) productById.set(product.id, product);
  }

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("name")
    .eq("id", sale.staff_id)
    .maybeSingle();

  if (staffError) throw staffError;

  return {
    ...sale,
    sale_items: (items ?? []).map((item) => ({
      ...item,
      products: productById.get(item.product_id) ?? null,
    })),
    staff: staffRow ?? null,
  } as SaleWithItems;
}

/** บิลล่าสุดในรอบขาย (ใช้บนหน้าขายเพื่อกลับไปดูใบเสร็จก่อนหน้า) */
export async function listSalesByShift(shiftId: Uuid, limit = 20): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Sale[];
}
