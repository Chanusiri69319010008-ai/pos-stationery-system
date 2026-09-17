// =====================================================================
// PromotionTable — ตารางโปรโมชั่น (§5 หน้า 8)
// สถานะที่แสดงคือการอ่านเงื่อนไขเดียวกับที่ checkout_sale ใช้คัดโปร
// (is_active + วันนี้อยู่ในช่วงวันที่) ไม่ได้คิดส่วนลดใด ๆ ที่นี่
// =====================================================================
import { formatMoney, formatPercent } from "../../lib/money";
import { formatDate, todayInBangkok } from "../../lib/datetime";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import type { PromotionWithProduct } from "../../api/promotions.api";

type Status = { label: string; tone: "default" | "success" | "warning" };

function statusOf(promo: PromotionWithProduct, today: string): Status {
  if (!promo.is_active) return { label: "ปิดอยู่", tone: "default" };
  if (today < promo.start_date) return { label: "ยังไม่ถึงวันเริ่ม", tone: "default" };
  if (today > promo.end_date) return { label: "หมดอายุแล้ว", tone: "default" };
  return { label: "กำลังใช้งาน", tone: "success" };
}

export function PromotionTable({
  promotions,
  onEdit,
  onToggleActive,
}: {
  promotions: PromotionWithProduct[];
  onEdit: (promo: PromotionWithProduct) => void;
  onToggleActive: (promo: PromotionWithProduct) => void;
}) {
  const today = todayInBangkok();

  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">ชื่อโปรโมชั่น</th>
            <th className="px-3 py-2 font-medium">รูปแบบ</th>
            <th className="px-3 py-2 font-medium">เงื่อนไข</th>
            <th className="px-3 py-2 font-medium text-right">ส่วนลด</th>
            <th className="px-3 py-2 font-medium">ช่วงเวลา</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {promotions.map((promo) => {
            const status = statusOf(promo, today);
            return (
              <tr key={promo.id} className="border-t border-royal/15">
                <td className="px-3 py-2">{promo.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {promo.scope === "item" ? "ลด % รายสินค้า" : "ซื้อครบลดเป็นบาท"}
                </td>
                <td className="px-3 py-2">
                  {promo.scope === "item" ? (
                    <span>
                      {promo.product_name ?? "ไม่พบสินค้า"}
                      {promo.product_sku && (
                        <span className="text-ink/60 num"> ({promo.product_sku})</span>
                      )}
                    </span>
                  ) : (
                    <span className="num">ซื้อครบ {formatMoney(promo.min_amount)}</span>
                  )}
                </td>
                <td className="px-3 py-2 num text-right whitespace-nowrap">
                  {promo.scope === "item"
                    ? formatPercent(promo.discount_value)
                    : formatMoney(promo.discount_value)}
                </td>
                <td className="px-3 py-2 num whitespace-nowrap">
                  {formatDate(`${promo.start_date}T00:00:00+07:00`)} –{" "}
                  {formatDate(`${promo.end_date}T00:00:00+07:00`)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => onEdit(promo)}>แก้ไข</Button>
                    <Button onClick={() => onToggleActive(promo)}>
                      {promo.is_active ? "ปิด" : "เปิด"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
