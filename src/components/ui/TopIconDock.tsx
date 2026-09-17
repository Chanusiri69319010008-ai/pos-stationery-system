// =====================================================================
// TopIconDock — แถบเมนูแนวนอนด้านบนสุดของทุกหน้า (ใช้แทน sidebar ทั้งระบบ)
//   สูง 56px (มือถือ 48px) พื้น Paper เส้นขอบล่าง 1px Royal ไม่มีเงา ไม่มี gradient
//   หน้าที่กำลังใช้งาน: underline 2px สี Royal ใต้ไอคอนเท่านั้น ไม่ทำพื้นเต็มแถบ
//   จอแคบ: label หาย เหลือแต่ไอคอน แต่ tap target ยังไม่เล็กกว่า 44x44px
//   เมนูเกินความกว้างจอ: เลื่อนแนวนอนได้ ห้ามยุบเป็น hamburger
// เมนูแสดงตามสิทธิ์ §2 — การซ่อนเมนูเป็น UX เท่านั้น ความปลอดภัยจริงอยู่ที่ RLS
// =====================================================================
import { NavLink } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  Tag,
  FileBarChart,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { paths } from "../../routes/paths";
import { useAuth } from "../../hooks/useAuth";

type DockItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  ownerOnly: boolean;
};

// เมนูของกลุ่มงาน P0 เท่านั้น — หน้าอื่นจะถูกเพิ่มเมื่อสร้างหน้านั้นจริงใน P1/P2
// (ห้ามใส่เมนูที่กดแล้วไปหน้าเปล่า)
const dockItems: DockItem[] = [
  { to: paths.pos, label: "ขายสินค้า", icon: ShoppingCart, ownerOnly: false },
  { to: paths.shift, label: "รอบขาย", icon: ClipboardList, ownerOnly: false },
  { to: paths.salesHistory, label: "ประวัติการขาย", icon: ReceiptText, ownerOnly: false },
  { to: paths.stock, label: "ดูสต็อก", icon: Boxes, ownerOnly: false },
  { to: paths.dashboard, label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { to: paths.products, label: "จัดการสินค้า", icon: Package, ownerOnly: true },
  { to: paths.stockManage, label: "จัดการสต็อก", icon: PackagePlus, ownerOnly: true },
  { to: paths.promotions, label: "โปรโมชั่น", icon: Tag, ownerOnly: true },
  { to: paths.returns, label: "คืนสินค้า", icon: RotateCcw, ownerOnly: true },
  { to: paths.reports, label: "รายงาน", icon: FileBarChart, ownerOnly: true },
  { to: paths.suppliers, label: "ซัพพลายเออร์", icon: Truck, ownerOnly: true },
  { to: paths.staff, label: "พนักงาน", icon: Users, ownerOnly: true },
];

function shortName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 12 ? `${first.slice(0, 12)}…` : first;
}

export function TopIconDock() {
  const { staff, isOwner, signOut } = useAuth();
  const items = dockItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-dock-sm sm:h-dock bg-paper border-b border-royal/25 no-print">
      <div className="h-full flex items-stretch">
        <span className="hidden md:flex items-center pl-4 pr-3 font-display text-xl text-royal tracking-wide shrink-0">
          Aunchan
        </span>

        <nav className="flex-1 flex items-stretch gap-1 overflow-x-auto px-1" aria-label="เมนูหลัก">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === paths.pos}
                className={({ isActive }) =>
                  [
                    "shrink-0 min-w-touch min-h-touch px-3 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2",
                    "border-b-2 text-royal",
                    isActive ? "border-royal font-medium" : "border-transparent",
                  ].join(" ")
                }
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden />
                <span className="hidden sm:inline text-sm">{item.label}</span>
                <span className="sr-only sm:hidden">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 flex items-center gap-2 pl-2 pr-2 sm:pr-4 border-l border-royal/20">
          <span className="hidden sm:inline text-sm text-ink/80">
            {staff ? shortName(staff.name) : ""}
            {isOwner && <span className="ml-1 text-xs text-royal">(เจ้าของร้าน)</span>}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-touch min-w-touch flex items-center justify-center gap-1 px-2 text-royal border border-royal/30 rounded"
          >
            <LogOut size={18} strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline text-sm">ออกจากระบบ</span>
            <span className="sr-only sm:hidden">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
}
