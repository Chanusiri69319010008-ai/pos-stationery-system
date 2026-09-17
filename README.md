# Aunchan — POS & Stock Management

ระบบขายหน้าร้านและจัดการสต็อกสำหรับร้านเครื่องเขียน ตามข้อกำหนดใน [AUNCHAN-SPEC.md](AUNCHAN-SPEC.md)

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (เขียน component เอง ไม่ใช้ UI library) |
| Routing | React Router |
| Data / Auth | Supabase (PostgreSQL + Auth) เรียกตรงจาก frontend ไม่มี backend แยก |
| Business logic | Postgres function (RPC) ใน `supabase/migrations/` |

---

## โครงสร้างโปรเจกต์

```
supabase/migrations/    001_tables  002_rls  003_triggers
                        004_rpc_checkout  006_rpc_shift  007_seed
                        (005_rpc_stock — กลุ่มงาน P1)
src/lib/                supabase.ts (client เดียว) · money.ts (แปลง/แสดงเงินที่เดียว)
                        datetime.ts · promptpay.ts
src/api/                1 ไฟล์ต่อ resource — เรียก .rpc()/.from() เท่านั้น ไม่มี logic คำนวณ
src/hooks/              state + fetch เรียก api/ อย่างเดียว ไม่คำนวณเลขเอง
src/pages/              1 ไฟล์ต่อ 1 หน้าตาม §5
src/components/ui/      ของใช้ร่วม (TopIconDock, Button, Modal, Toast, StatusBadge …)
src/components/<page>/  component เฉพาะของแต่ละหน้า
src/types/db.ts         type ตรงกับ schema แบบ 1:1
```

กฎที่ห้ามละเมิด: **การคำนวณเงิน ส่วนลด VAT ต้นทุน และการตัดสต็อก อยู่ใน RPC เท่านั้น**
หน้าเว็บส่งเข้า RPC เฉพาะ `product_id` กับ `quantity` ตัวเลขบนหน้าจอขายเป็นเพียงประมาณการ

---

## ติดตั้งและรัน

ต้องมี **Node.js 18 ขึ้นไป** (ยังไม่ได้ติดตั้งบนเครื่องนี้ — ดาวน์โหลดจาก https://nodejs.org)

```powershell
npm install
Copy-Item .env.example .env.local   # แล้วใส่ค่าจริงจาก Supabase
npm run dev                          # http://localhost:5173
```

`.env.local`

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

ห้ามใส่ `service_role` key ในไฟล์นี้เด็ดขาด

---

## รัน migration บน Supabase

เปิด Supabase Dashboard → **SQL Editor** → วางเนื้อหาทีละไฟล์แล้วกด Run **ตามลำดับนี้**

1. `supabase/migrations/001_tables.sql`
2. `supabase/migrations/002_rls.sql`
3. `supabase/migrations/003_triggers.sql`
4. `supabase/migrations/004_rpc_checkout.sql`
5. `supabase/migrations/006_rpc_shift.sql`
6. `supabase/migrations/007_seed.sql`

ทุกไฟล์รันซ้ำได้อย่างปลอดภัย และจบด้วยการตรวจสอบตัวเอง (`raise notice` เมื่อผ่าน / `raise exception` เมื่อไม่ผ่าน)

ถ้า 001 ฟ้องว่าพบตารางเดิมที่โครงสร้างไม่ตรงกับ §6 แปลว่าในฐานข้อมูลมีตารางชื่อเดียวกันจากระบบเก่าค้างอยู่
ตรวจดูด้วย query ใน `supabase/migrations/000_reset.sql` แล้วรันไฟล์นั้น (**ลบถาวร**) ก่อนเริ่มที่ 001 ใหม่

ไฟล์ที่ 6 จะปิดท้ายด้วย query ตรวจสอบเกณฑ์ §10 ข้อ 8 — **ต้องได้ 0 แถว** จึงจะถือว่าสต็อกตรงกับรายการเคลื่อนไหว

### บัญชีทดสอบที่ seed ไว้

| อีเมล | รหัสผ่าน | สิทธิ์ |
|---|---|---|
| owner@aunchan.local | Aunchan123! | owner |
| staff@aunchan.local | Aunchan123! | staff |

---

## ความคืบหน้าตาม §11

**P0 (เสร็จแล้ว รอทดสอบบน Supabase จริง)**
- schema + RLS + trigger + seed
- auth + routing แยกเมนูตาม role (Top Icon Dock)
- RPC `open_shift`, `close_shift`, `checkout_sale`
- หน้าขาย POS + พรีวิว/พิมพ์ใบเสร็จ 58 มม.
- จัดการสินค้า (CRUD) + ดูสต็อก + แจ้งเตือนถึงจุดสั่งซื้อ

**P1 (ยังไม่เริ่ม)** รับสินค้าเข้า/ปรับยอด/ประวัติการเคลื่อนไหว · ประวัติการขาย · Dashboard · โปรโมชั่น · คืนสินค้า/ยกเลิกบิล

**P2 (ยังไม่เริ่ม)** รายงาน + CSV · ซัพพลายเออร์ + พนักงาน · audit log UI + รูปสินค้า · Bruno collection + เอกสารส่งงาน

---

## หมายเหตุด้านภาษี

ตามมาตรา 86/6 ประมวลรัษฎากร กิจการค้าปลีกที่ออกใบกำกับภาษีอย่างย่อต้องแสดงราคาที่รวม VAT แล้ว
ระบบนี้เก็บ `products.price` เป็นราคาไม่รวม VAT แล้วบวก 7% ท้ายบิล จึงต่างจากข้อกำหนดจริง —
ยอมรับได้ในบริบทโปรเจกต์การศึกษา และเอกสารที่ระบบพิมพ์ออกเรียกว่า "ใบเสร็จรับเงิน" ไม่ใช่ใบกำกับภาษีอย่างย่อ
