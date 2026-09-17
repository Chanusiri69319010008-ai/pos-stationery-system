// =====================================================================
// SalesTable — ตารางประวัติการขาย (§5 หน้า 3)
// ยอดทุกช่องอ่านจากแถว sales ที่บันทึกไว้ ไม่มีการคำนวณใหม่
// =====================================================================
import { formatMoney } from "../../lib/money";
import { formatDateTime } from "../../lib/datetime";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import type { SaleListRow } from "../../api/reports.api";
import type { SaleStatus } from "../../types/db";

const statusLabel: Record<SaleStatus, string> = {
  completed: "สำเร็จ",
  voided: "ยกเลิก",
  partially_returned: "คืนบางส่วน",
  returned: "คืนทั้งบิล",
};

const statusTone: Record<SaleStatus, "default" | "success" | "warning" | "danger"> = {
  completed: "default",
  voided: "danger",
  partially_returned: "warning",
  returned: "warning",
};

export function SalesTable({
  rows,
  onOpenReceipt,
  onOpenReturn,
}: {
  rows: SaleListRow[];
  onOpenReceipt: (saleId: string) => void;
  /** owner เท่านั้น — ไม่ส่งมา = ไม่แสดงปุ่มคืนสินค้า */
  onOpenReturn?: (saleId: string) => void;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">เลขที่บิล</th>
            <th className="px-3 py-2 font-medium">วันเวลา</th>
            <th className="px-3 py-2 font-medium">พนักงาน</th>
            <th className="px-3 py-2 font-medium">ชำระโดย</th>
            <th className="px-3 py-2 font-medium text-right">ยอดก่อนภาษี</th>
            <th className="px-3 py-2 font-medium text-right">VAT</th>
            <th className="px-3 py-2 font-medium text-right">ยอดสุทธิ</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => (
            <tr key={sale.id} className="border-t border-royal/15">
              <td className="px-3 py-2 num whitespace-nowrap">{sale.receipt_no}</td>
              <td className="px-3 py-2 num whitespace-nowrap">{formatDateTime(sale.created_at)}</td>
              <td className="px-3 py-2">{sale.staff?.name ?? "-"}</td>
              <td className="px-3 py-2">
                {sale.payment_method === "cash" ? "เงินสด" : "พร้อมเพย์"}
              </td>
              <td className="px-3 py-2 num text-right">{formatMoney(sale.subtotal)}</td>
              <td className="px-3 py-2 num text-right">{formatMoney(sale.vat_amount)}</td>
              <td className="px-3 py-2 num text-right font-medium">
                {formatMoney(sale.total_amount)}
              </td>
              <td className="px-3 py-2">
                <StatusBadge tone={statusTone[sale.status]}>
                  {statusLabel[sale.status]}
                </StatusBadge>
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <Button onClick={() => onOpenReceipt(sale.id)}>ใบเสร็จ</Button>
                  {onOpenReturn && sale.status !== "voided" && sale.status !== "returned" && (
                    <Button onClick={() => onOpenReturn(sale.id)}>คืน/ยกเลิก</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
