// แจ้งเตือนสินค้าถึงจุดสั่งซื้อ — นิยาม quantity <= reorder_point (เท่ากันนับด้วย) §4
import { AlertTriangle } from "lucide-react";
import type { ProductWithStock } from "../../types/db";

export function LowStockBanner({ items }: { items: ProductWithStock[] }) {
  if (items.length === 0) return null;

  return (
    <div className="panel p-3 mb-3 border-warning/40">
      <div className="flex items-start gap-2">
        <AlertTriangle size={20} strokeWidth={1.5} className="text-warning shrink-0" aria-hidden />
        <div>
          <p className="font-medium text-warning">
            มีสินค้าถึงจุดสั่งซื้อ {items.length} รายการ
          </p>
          <p className="text-sm text-ink/70">
            {items
              .slice(0, 6)
              .map((item) => `${item.name} (เหลือ ${item.quantity})`)
              .join(" · ")}
            {items.length > 6 ? ` และอีก ${items.length - 6} รายการ` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
