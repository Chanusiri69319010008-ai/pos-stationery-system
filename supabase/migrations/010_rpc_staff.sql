-- =====================================================================
-- Aunchan POS — 010_rpc_staff.sql
-- ตัวช่วยหน้าจัดการพนักงาน (§5 หน้า 12)
-- concern เดียว: การผูกบัญชีล็อกอินเข้ากับแถวในตาราง staff
-- รันซ้ำได้อย่างปลอดภัย (create or replace)
-- =====================================================================
--
-- ทำไมต้องมีไฟล์นี้
--   staff.id ต้องเท่ากับ auth.users.id เสมอ (RLS ทุกข้อเทียบกับ auth.uid())
--   การสร้างบัญชีล็อกอินทำได้ 2 ทางเท่านั้นถ้าไม่มี backend แยกและห้ามใช้
--   service_role ในเบราว์เซอร์ (§1):
--     1. หน้าเว็บเรียก auth signUp เอง แล้วเอา id ที่ได้มาสร้างแถว staff
--     2. เจ้าของร้านสร้างผู้ใช้ใน Supabase Dashboard แล้วค่อยผูกเข้ากับแถว staff
--   ทางที่ 2 ต้องรู้ว่ามีบัญชีไหนใน auth.users ที่ยังไม่มีแถว staff
--   ซึ่ง PostgREST อ่าน schema auth ไม่ได้ จึงต้องมีฟังก์ชัน security definer ตัวนี้
--
-- list_unlinked_auth_users
--   input : ไม่มี
--   output: ตาราง (user_id, email, created_at) ของบัญชีที่ยังไม่มีแถวใน staff
--   สิทธิ์ : owner เท่านั้น — คนอื่นเรียกได้แต่จะได้ 0 แถว (เงื่อนไขอยู่ใน where)
--   หมายเหตุ: อ่านอย่างเดียว ไม่เขียน auth.users และไม่คืนรหัสผ่านหรือ token ใด ๆ
-- =====================================================================

create or replace function public.list_unlinked_auth_users()
returns table (user_id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email::text, u.created_at
  from auth.users u
  where public.is_owner()
    and not exists (select 1 from public.staff s where s.id = u.id)
  order by u.created_at desc;
$$;

revoke all on function public.list_unlinked_auth_users() from public, anon;
grant execute on function public.list_unlinked_auth_users() to authenticated;

-- =====================================================================
-- ตรวจสอบผลลัพธ์
-- =====================================================================
do $$
begin
  if to_regprocedure('public.list_unlinked_auth_users()') is null then
    raise exception '010_rpc_staff: สร้างฟังก์ชันไม่สำเร็จ';
  end if;

  raise notice '010_rpc_staff: สร้าง list_unlinked_auth_users แล้ว';
end $$;
