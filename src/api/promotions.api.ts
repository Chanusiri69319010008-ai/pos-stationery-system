// =====================================================================
// promotions.api.ts — เรียก .from("promotions") ตรง ๆ (owner เขียนได้ตาม RLS §2)
// ห้ามมี logic คำนวณส่วนลดในไฟล์นี้ — การเลือกโปรที่ลดมากที่สุดและการคิดเงิน
// ทั้งหมดอยู่ใน checkout_sale (004_rpc_checkout.sql ขั้นที่ 9 และ 11)
// ไฟล์นี้ทำได้แค่บันทึก "เงื่อนไข" ของโปรโมชั่นลงตาราง
// =====================================================================
import { supabase } from "../lib/supabase";
import type {
  DateOnly,
  DiscountType,
  Promotion,
  PromotionScope,
  ProductForStaff,
  Uuid,
} from "../types/db";

/** โปรโมชั่น + ชื่อสินค้าที่ผูกไว้ (scope = 'bill' จะเป็น null) */
export type PromotionWithProduct = Promotion & {
  product_name: string | null;
  product_sku: string | null;
};

/**
 * โปรโมชั่นทั้งหมด เรียงโปรที่ยังไม่หมดอายุขึ้นก่อน
 * อ่านชื่อสินค้าแยกอีกคำสั่ง เพราะ products_for_staff เป็น view จึง embed ไม่ได้
 * (การจับคู่ชื่อเข้ากับแถวไม่ใช่การคำนวณ)
 */
export async function listPromotions(): Promise<PromotionWithProduct[]> {
  const [{ data: promotions, error: prErr }, { data: products, error: pErr }] = await Promise.all([
    supabase
      .from("promotions")
      .select("*")
      .order("end_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("products_for_staff").select("id, name, sku"),
  ]);

  if (prErr) throw prErr;
  if (pErr) throw pErr;

  const productById = new Map<Uuid, Pick<ProductForStaff, "name" | "sku">>(
    (products ?? []).map((p) => [p.id, p]),
  );

  return (promotions ?? []).map((promo: Promotion) => ({
    ...promo,
    product_name: promo.product_id ? productById.get(promo.product_id)?.name ?? null : null,
    product_sku: promo.product_id ? productById.get(promo.product_id)?.sku ?? null : null,
  }));
}

/**
 * ค่าที่บันทึกลงตาราง promotions — ชื่อฟิลด์ตรงกับคอลัมน์ 1:1
 * ฐานข้อมูลบังคับคู่ scope/discount_type ไว้แล้วด้วย constraint
 * promotions_scope_discount_type_chk (001_tables.sql)
 */
export type PromotionInput = {
  name: string;
  scope: PromotionScope;
  product_id: Uuid | null;
  min_amount: number | null;
  discount_type: DiscountType;
  discount_value: number;
  start_date: DateOnly;
  end_date: DateOnly;
  is_active: boolean;
};

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const { data, error } = await supabase.from("promotions").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updatePromotion(id: Uuid, input: PromotionInput): Promise<Promotion> {
  const { data, error } = await supabase
    .from("promotions")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** เปิด/ปิดโปรโมชั่น — ไม่มีการลบ เพราะ sale_items อ้างถึง promotion_id ของบิลเก่า (§4) */
export async function setPromotionActive(id: Uuid, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("promotions")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw error;
}
