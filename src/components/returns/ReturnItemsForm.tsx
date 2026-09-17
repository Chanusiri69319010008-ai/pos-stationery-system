// =====================================================================
// ReturnItemsForm — เลือกรายการและจำนวนที่จะคืน (§5 หน้า 9)
// ห้ามคำนวณยอดเงินคืนบนหน้าจอ — ยอดจริงมาจาก RPC create_return เท่านั้น (§7.3)
// หน้านี้จึงแสดงได้แค่ "ขายไปกี่ชิ้น คืนไปแล้วกี่ชิ้น เหลือคืนได้กี่ชิ้น"
// =====================================================================
import { formatMoney } from "../../lib/money";
import type { SaleWithItems } from "../../types/db";

export type ReturnDraft = Record<string, { quantity: string; restock: boolean }>;

export function ReturnItemsForm({
  sale,
  draft,
  onChange,
}: {
  sale: SaleWithItems;
  draft: ReturnDraft;
  onChange: (saleItemId: string, patch: { quantity?: string; restock?: boolean }) => void;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">สินค้า</th>
            <th className="px-3 py-2 font-medium text-right">ขายไป</th>
            <th className="px-3 py-2 font-medium text-right">คืนแล้ว</th>
            <th className="px-3 py-2 font-medium text-right">คืนได้อีก</th>
            <th className="px-3 py-2 font-medium text-right">ยอดก่อนภาษี</th>
            <th className="px-3 py-2 font-medium text-right">จำนวนที่จะคืน</th>
            <th className="px-3 py-2 font-medium">คืนเข้าสต็อก</th>
          </tr>
        </thead>
        <tbody>
          {sale.sale_items.map((item) => {
            const remaining = item.quantity - item.returned_qty;
            const row = draft[item.id] ?? { quantity: "", restock: true };

            return (
              <tr key={item.id} className="border-t border-royal/15">
                <td className="px-3 py-2">
                  {item.products?.name ?? "-"}
                  <span className="block text-xs text-ink/60 num">{item.products?.sku ?? ""}</span>
                </td>
                <td className="px-3 py-2 num text-right">{item.quantity}</td>
                <td className="px-3 py-2 num text-right">{item.returned_qty}</td>
                <td className="px-3 py-2 num text-right font-medium">{remaining}</td>
                <td className="px-3 py-2 num text-right">{formatMoney(item.line_total_excl_vat)}</td>
                <td className="px-3 py-2 text-right">
                  {remaining === 0 ? (
                    <span className="text-ink/60 text-sm">คืนครบแล้ว</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(e) => onChange(item.id, { quantity: e.target.value })}
                      aria-label={`จำนวนที่จะคืนของ ${item.products?.name ?? ""}`}
                      className="w-24 min-h-touch num text-right"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2 min-h-touch">
                    <input
                      type="checkbox"
                      checked={row.restock}
                      disabled={remaining === 0}
                      onChange={(e) => onChange(item.id, { restock: e.target.checked })}
                    />
                    <span className="text-sm">{row.restock ? "ของขายต่อได้" : "ของเสีย"}</span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="px-3 py-2 text-xs text-ink/60 border-t border-royal/15">
        เอาเครื่องหมายถูกออก = ของชำรุดขายต่อไม่ได้ ระบบจะคืนเงินให้ลูกค้าแต่ไม่บวกกลับเข้าสต็อก ·
        ยอดเงินคืนจริงระบบจะคำนวณให้ตอนกดยืนยัน
      </p>
    </div>
  );
}
