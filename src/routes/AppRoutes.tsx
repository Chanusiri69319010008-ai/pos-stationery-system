// =====================================================================
// AppRoutes — เส้นทางของกลุ่มงาน P0 (§11 ข้อ 2, 4, 5)
// หน้าอื่นจะถูกเพิ่มเมื่อสร้างจริงใน P1/P2 ไม่สร้างหน้าเปล่าไว้ก่อน
// =====================================================================
import { Navigate, Route, Routes } from "react-router-dom";
import { paths } from "./paths";
import { OwnerRoute, ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../layouts/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { POSPage } from "../pages/POSPage";
import { ReceiptPage } from "../pages/ReceiptPage";
import { ShiftPage } from "../pages/ShiftPage";
import { StockViewPage } from "../pages/StockViewPage";
import { ProductsPage } from "../pages/ProductsPage";
import { StockManagePage } from "../pages/StockManagePage";
import { SalesHistoryPage } from "../pages/SalesHistoryPage";
import { DashboardPage } from "../pages/DashboardPage";
import { PromotionsPage } from "../pages/PromotionsPage";
import { ReturnsPage } from "../pages/ReturnsPage";
import { SuppliersPage } from "../pages/SuppliersPage";
import { StaffPage } from "../pages/StaffPage";
import { ReportsPage } from "../pages/ReportsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path={paths.pos} element={<POSPage />} />
          <Route path={paths.receipt} element={<ReceiptPage />} />
          <Route path={paths.shift} element={<ShiftPage />} />
          <Route path={paths.stock} element={<StockViewPage />} />
          <Route path={paths.salesHistory} element={<SalesHistoryPage />} />

          <Route element={<OwnerRoute />}>
            <Route path={paths.dashboard} element={<DashboardPage />} />
            <Route path={paths.products} element={<ProductsPage />} />
            <Route path={paths.promotions} element={<PromotionsPage />} />
            <Route path={paths.returns} element={<ReturnsPage />} />
            <Route path={paths.suppliers} element={<SuppliersPage />} />
            <Route path={paths.staff} element={<StaffPage />} />
            <Route path={paths.reports} element={<ReportsPage />} />
            <Route path={paths.stockManage} element={<StockManagePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={paths.pos} replace />} />
    </Routes>
  );
}
