// =====================================================================
// storage.api.ts — ไฟล์รูปสินค้าใน Supabase Storage (§11 ข้อ 12)
// bucket: product-images (public) สิทธิ์เขียนเป็นของ owner บังคับที่ storage.objects
// ไฟล์นี้ทำแค่ อัปโหลด / ลบ / แปลงเป็น URL — ไม่มี logic ธุรกิจ
// =====================================================================
import { supabase } from "../lib/supabase";

const BUCKET = "product-images";

/** ชนิดและขนาดที่ bucket ยอมรับ — ตรงกับที่ตั้งไว้ใน 012_storage_products.sql */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

function extensionOf(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * อัปโหลดรูปสินค้า แล้วคืน public URL สำหรับเก็บลง products.image_url
 * ตั้งชื่อไฟล์ด้วย sku + เวลา เพื่อไม่ให้ทับของเดิมและกัน cache ค้าง
 */
export async function uploadProductImage(file: File, sku: string): Promise<string> {
  const safeSku = sku.trim().replace(/[^A-Za-z0-9_-]/g, "") || "product";
  const path = `${safeSku}/${Date.now()}.${extensionOf(file)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** ลบรูปเก่าออกจาก bucket — เรียกหลังเปลี่ยนรูปสำเร็จแล้วเท่านั้น */
export async function deleteProductImage(publicUrl: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index < 0) return;

  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
