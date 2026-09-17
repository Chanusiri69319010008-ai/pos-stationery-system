-- =====================================================================
-- Aunchan POS — 012_storage_products.sql
-- รูปสินค้าใน Supabase Storage (§11 ข้อ 12)
-- concern เดียว: ที่เก็บไฟล์รูปสินค้าและสิทธิ์การเข้าถึง
-- รันซ้ำได้อย่างปลอดภัย
-- =====================================================================
--
-- bucket: product-images
--   public = true  → รูปเปิดดูได้ด้วย URL ตรง ไม่ต้องเซ็น URL ทุกครั้ง
--                    หน้าขายจึงโหลดรูปได้เร็วและใช้ได้แม้ session หมดอายุ
--                    (เก็บได้เฉพาะรูปสินค้าเท่านั้น ห้ามเอาไฟล์อื่นมาใส่)
--   จำกัดขนาด 2 MB และรับเฉพาะ jpeg / png / webp เพื่อกันไฟล์แปลกปลอม
--
-- สิทธิ์ (บังคับที่ storage.objects ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ)
--   อ่าน  : ใครก็ได้ที่มี URL (เพราะ bucket เป็น public)
--   เขียน : owner เท่านั้น — staff อัปโหลดหรือลบรูปไม่ได้
--
-- ถ้ารันแล้วติด permission ที่ storage.objects ให้สร้าง policy จากหน้า
-- Supabase Dashboard → Storage → product-images → Policies แทน
-- (บาง project ตั้งสิทธิ์ของ schema storage ไว้ต่างกัน)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- อ่านรูปได้ทุกคน (ต้องมี policy ด้วย เพราะ storage.objects เปิด RLS อยู่)
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select
  using (bucket_id = 'product-images');

-- อัปโหลด/แก้ไข/ลบ เฉพาะเจ้าของร้าน
drop policy if exists product_images_owner_insert on storage.objects;
create policy product_images_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_owner());

drop policy if exists product_images_owner_update on storage.objects;
create policy product_images_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_owner())
  with check (bucket_id = 'product-images' and public.is_owner());

drop policy if exists product_images_owner_delete on storage.objects;
create policy product_images_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_owner());

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
declare
  v_policies integer;
begin
  if not exists (select 1 from storage.buckets where id = 'product-images') then
    raise exception '012_storage_products: ไม่พบ bucket product-images';
  end if;

  select count(*) into v_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname like 'product_images%';

  if v_policies < 4 then
    raise exception '012_storage_products: policy ไม่ครบ (มี % ข้อ ต้องมี 4)', v_policies;
  end if;

  raise notice '012_storage_products: สร้าง bucket product-images + policy 4 ข้อแล้ว';
end $$;
