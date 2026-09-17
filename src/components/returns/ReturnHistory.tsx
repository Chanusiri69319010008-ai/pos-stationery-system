// =====================================================================
// ReturnHistory — ใบคืนที่เคยทำกับบิลนี้ (§5 หน้า 9)
// ยอดทุกตัวอ่านจากตาราง returns / return_items ตรง ๆ ไม่มีการรวมใหม่
// =====================================================================
import { formatMoney } from "../../lib/money";
import { formatDateTime } from "../../lib/datetime";
import type { ReturnWithItems } from "../../api/returns.api";

export function ReturnHistory({
  history,
  nameOf,
}: {
  history: ReturnWithItems[];
  nameOf: (saleItemId: string) => string;
}) {
  if (history.length === 0) return null;

  return (
    <div className="panel p-4 mt-3">
      <h2 className="font-display text-xl text-royal mb-3">ประวัติการคืนของบิลนี้</h2>

      <ul className="space-y-3">
        {history.map((entry) => (
          <li key={entry.id} className="border border-royal/20 rounded p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="num">{formatDateTime(entry.created_at)}</span>
              <span className="num font-medium">
                คืนเงิน {formatMoney(entry.refund_amount)}
                <span className="ml-1 text-sm text-ink/70">
                  ({entry.refund_method === "cash" ? "เงินสด" : "พร้อมเพย์"})
                </span>
              </span>
            </div>

            <p className="text-sm text-ink/80 mt-1">เหตุผล: {entry.reason}</p>

            <ul className="mt-2 text-sm space-y-1">
              {entry.return_items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>
                    {nameOf(item.sale_item_id)} × <span className="num">{item.quantity}</span>
                    {!item.restock && <span className="text-ink/60"> (ไม่คืนเข้าสต็อก)</span>}
                  </span>
                  <span className="num">{formatMoney(item.refund_amount)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
