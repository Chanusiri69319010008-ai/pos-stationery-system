// =====================================================================
// Receipt58mm — พรีวิวใบเสร็จความกว้าง 58 มม. แล้วสั่งพิมพ์ผ่านเบราว์เซอร์ (§5 หน้า 2)
// เรียกว่า "ใบเสร็จรับเงิน" เท่านั้น ไม่ใช้คำว่าใบกำกับภาษีอย่างย่อ (§4 VAT)
// ตัวเลขทุกตัวมาจากแถว sales / sale_items ที่บันทึกไว้แล้ว ไม่คำนวณใหม่ที่นี่
// =====================================================================
import { formatAmount, formatMoney, parseMoney } from "../../lib/money";
import { formatDate, formatTime } from "../../lib/datetime";
import type { SaleWithItems, StoreSettings } from "../../types/db";

export function Receipt58mm({
  sale,
  settings,
}: {
  sale: SaleWithItems;
  settings: StoreSettings | null;
}) {
  const itemDiscount = parseMoney(sale.item_discount);
  const billDiscount = parseMoney(sale.bill_discount);
  const manualDiscount = parseMoney(sale.manual_discount);

  return (
    <div className="receipt-58 border border-royal/20 mx-auto">
      <div className="text-center">
        <p className="text-[13px] font-bold tracking-wide">{settings?.shop_name ?? "Aunchan"}</p>
        {settings?.address && <p className="text-[9px] leading-tight">{settings.address}</p>}
        {settings?.tax_id && <p className="text-[9px]">เลขประจำตัวผู้เสียภาษี {settings.tax_id}</p>}
        <p className="mt-1 text-[11px] font-bold">ใบเสร็จรับเงิน</p>
      </div>

      <div className="mt-1 border-t border-dashed border-black pt-1">
        <div className="flex justify-between">
          <span>เลขที่บิล</span>
          <span>{sale.receipt_no}</span>
        </div>
        <div className="flex justify-between">
          <span>วันที่</span>
          <span>
            {formatDate(sale.created_at)} {formatTime(sale.created_at)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>พนักงาน</span>
          <span>{sale.staff?.name ?? "-"}</span>
        </div>
      </div>

      <div className="mt-1 border-t border-dashed border-black pt-1">
        {sale.sale_items.map((item) => (
          <div key={item.id} className="mb-1">
            <p className="leading-tight">{item.products?.name ?? item.product_id}</p>
            <div className="flex justify-between">
              <span>
                {item.quantity} x {formatAmount(item.unit_price)}
              </span>
              <span>{formatAmount(item.line_total_excl_vat)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 border-t border-dashed border-black pt-1">
        <div className="flex justify-between">
          <span>ยอดก่อนภาษี</span>
          <span>{formatAmount(sale.subtotal)}</span>
        </div>
        {itemDiscount > 0 && (
          <div className="flex justify-between">
            <span>ส่วนลดรายสินค้า</span>
            <span>-{formatAmount(itemDiscount)}</span>
          </div>
        )}
        {billDiscount > 0 && (
          <div className="flex justify-between">
            <span>ส่วนลดท้ายบิล</span>
            <span>-{formatAmount(billDiscount)}</span>
          </div>
        )}
        {manualDiscount > 0 && (
          <div className="flex justify-between">
            <span>ส่วนลดกดมือ</span>
            <span>-{formatAmount(manualDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>VAT {formatAmount(sale.vat_rate)}%</span>
          <span>{formatAmount(sale.vat_amount)}</span>
        </div>
        <div className="flex justify-between text-[12px] font-bold border-t border-black mt-1 pt-1">
          <span>ยอดสุทธิ</span>
          <span>{formatMoney(sale.total_amount)}</span>
        </div>
      </div>

      <div className="mt-1 border-t border-dashed border-black pt-1">
        <div className="flex justify-between">
          <span>ชำระโดย</span>
          <span>{sale.payment_method === "cash" ? "เงินสด" : "พร้อมเพย์"}</span>
        </div>
        {sale.cash_received !== null && (
          <div className="flex justify-between">
            <span>เงินรับ</span>
            <span>{formatAmount(sale.cash_received)}</span>
          </div>
        )}
        {sale.cash_change !== null && (
          <div className="flex justify-between">
            <span>เงินทอน</span>
            <span>{formatAmount(sale.cash_change)}</span>
          </div>
        )}
      </div>

      <p className="text-center mt-2 text-[9px]">ขอบคุณที่ใช้บริการ</p>
    </div>
  );
}
