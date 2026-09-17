// =====================================================================
// ProtectedRoute / OwnerRoute — กันหน้าเว็บตาม role (§2)
// เป็นเพียงชั้น UX ความปลอดภัยจริงบังคับด้วย RLS ที่ฐานข้อมูล
// =====================================================================
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { paths } from "./paths";

function Loading() {
  return (
    <div className="min-h-screen bg-bone flex items-center justify-center text-royal">
      กำลังโหลด…
    </div>
  );
}

export function ProtectedRoute() {
  const { session, staff, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!session) return <Navigate to={paths.login} state={{ from: location }} replace />;

  if (!staff) {
    return (
      <div className="min-h-screen bg-bone flex items-center justify-center p-6">
        <div className="panel p-6 max-w-md text-center">
          <p className="font-display text-xl text-royal mb-2">บัญชีนี้ยังไม่ถูกผูกกับพนักงาน</p>
          <p className="text-ink/70">
            ติดต่อเจ้าของร้านให้เพิ่มบัญชีนี้ในตารางพนักงานก่อนจึงจะใช้งานระบบได้
          </p>
        </div>
      </div>
    );
  }

  if (!staff.is_active) {
    return (
      <div className="min-h-screen bg-bone flex items-center justify-center p-6">
        <div className="panel p-6 max-w-md text-center">
          <p className="font-display text-xl text-royal mb-2">บัญชีนี้ถูกปิดการใช้งาน</p>
          <p className="text-ink/70">ติดต่อเจ้าของร้านเพื่อเปิดการใช้งานอีกครั้ง</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

export function OwnerRoute() {
  const { isOwner, loading } = useAuth();

  if (loading) return <Loading />;
  if (!isOwner) return <Navigate to={paths.pos} replace />;

  return <Outlet />;
}
