// =====================================================================
// AppLayout — โครงของทุกหน้าหลังเข้าสู่ระบบ
// TopIconDock อยู่บนสุดเสมอ ไม่มี sidebar ในระบบนี้
// เนื้อหาเว้นจากขอบบนเท่าความสูง dock เพื่อไม่ให้ dock บังเนื้อหา
// =====================================================================
import { Outlet } from "react-router-dom";
import { TopIconDock } from "../components/ui/TopIconDock";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bone">
      <TopIconDock />
      <main className="pt-12 sm:pt-14">
        <Outlet />
      </main>
    </div>
  );
}
