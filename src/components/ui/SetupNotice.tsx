// แสดงแทนหน้าจอขาวเมื่อยังไม่ได้ตั้งค่า .env.local
// (เกิดเมื่อรัน npm run dev โดยยังไม่ได้ใส่คีย์ Supabase)
export function SetupNotice() {
  return (
    <div className="min-h-screen bg-bone flex items-center justify-center p-4">
      <div className="panel p-6 max-w-xl">
        <p className="font-display text-3xl font-bold text-royal">Aunchan</p>
        <p className="page-title mt-4 text-xl">ยังตั้งค่าการเชื่อมต่อ Supabase ไม่ครบ</p>

        <p className="text-ink/80 mt-3">
          สร้างไฟล์ <span className="num">.env.local</span> ไว้ที่โฟลเดอร์หลักของโปรเจกต์
          แล้วใส่ค่า 2 บรรทัดนี้ (ดูได้ที่ Supabase Dashboard → Project Settings → API)
        </p>

        <pre className="mt-3 p-3 bg-powder/60 border border-royal/20 rounded text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>

        <p className="text-ink/80 mt-3">
          ใช้คีย์ <span className="num">anon public</span> เท่านั้น ห้ามใส่{" "}
          <span className="num">service_role</span> (§1)
        </p>

        <p className="text-ink/80 mt-3">
          บันทึกไฟล์แล้วปิด dev server ด้วย <span className="num">Ctrl+C</span> แล้วสั่ง{" "}
          <span className="num">npm run dev</span> ใหม่อีกครั้ง
        </p>

        <p className="text-xs text-ink/60 mt-4">
          หมายเหตุ: หน้านี้ต้องเปิดผ่าน <span className="num">npm run dev</span> เท่านั้น
          เปิด index.html ด้วย Live Server ไม่ได้ เพราะเบราว์เซอร์รันไฟล์ .tsx เองไม่ได้
        </p>
      </div>
    </div>
  );
}
