// =====================================================================
// MovementHistory — ประวัติการเคลื่อนไหวสต็อก (§5 หน้า 7)
// อ่านจากตาราง stock_movements ซึ่งเป็นแหล่งความจริงของสต็อก (§7.1)
// =====================================================================
import { formatDateTime } from "../../lib/datetime";
import { formatMoney } from "../../lib/money";
import { EmptyState } from "../ui/EmptyState";
import { StatusBadge } from "../ui/StatusBadge";
import type { MovementRow } from "../../api/stock.api";
import type { MovementType, ProductWithStock } from "../../types/db";

const typeLabel: Record<MovementType, string> = {
  sale: "ขาย",
  receive: "รับเข้า",
  adjust: "ปรับยอด",
  waste: "ของเสีย",
  return: "รับคืน",
};

export function MovementHistory({
  movements,
  products,
  loading,
  productId,
  type,
  onFilterChange,
}: {
  movements: MovementRow[];
  products: ProductWithStock[];
  loading: boolean;
  productId: string;
  type: string;
  onFilterChange: (next: { productId: string; type: string }) => void;
}) {
  return (
    <div className="panel p-4 space-y-3">
      <h2 className="font-display text-xl text-royal">ประวัติการเคลื่อนไหว</h2>

      <div className="grid gap-2 sm:grid-cols-2 max-w-2xl">
        <label className="block">
          <span className="block mb-1 text-sm">สินค้า</span>
          <select
            value={productId}
            onChange={(e) => onFilterChange({ productId: e.target.value, type })}
            className="w-full min-h-touch"
          >
            <option value="">ทุกสินค้า</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block mb-1 text-sm">ประเภท</span>
          <select
            value={type}
            onChange={(e) => onFilterChange({ productId, type: e.target.value })}
            className="w-full min-h-touch"
          >
            <option value="">ทุกประเภท</option>
            {(Object.keys(typeLabel) as MovementType[]).map((t) => (
              <option key={t} value={t}>
                {typeLabel[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="text-royal">กำลังโหลด…</p>}

      {!loading && movements.length === 0 && (
        <EmptyState
          title="ยังไม่มีรายการเคลื่อนไหว"
          description="รับสินค้าเข้า ปรับยอด หรือขายสินค้า แล้วรายการจะปรากฏที่นี่"
        />
      )}

      {!loading && movements.length > 0 && (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="bg-powder text-royal text-left">
                <th className="px-3 py-2 font-medium">วันเวลา</th>
                <th className="px-3 py-2 font-medium">สินค้า</th>
                <th className="px-3 py-2 font-medium">ประเภท</th>
                <th className="px-3 py-2 font-medium text-right">จำนวน</th>
                <th className="px-3 py-2 font-medium text-right">ต้นทุน/หน่วย</th>
                <th className="px-3 py-2 font-medium">เหตุผล</th>
                <th className="px-3 py-2 font-medium">ผู้ทำรายการ</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-royal/15">
                  <td className="px-3 py-2 num whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                  <td className="px-3 py-2">
                    {m.products?.name ?? "-"}
                    <span className="num block text-xs text-ink/60">{m.products?.sku ?? ""}</span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={m.qty_change < 0 ? "warning" : "default"}>
                      {typeLabel[m.type]}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 num text-right">
                    {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                  </td>
                  <td className="px-3 py-2 num text-right">
                    {m.unit_cost != null ? formatMoney(m.unit_cost) : "-"}
                  </td>
                  <td className="px-3 py-2">{m.reason ?? "-"}</td>
                  <td className="px-3 py-2">{m.staff?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
