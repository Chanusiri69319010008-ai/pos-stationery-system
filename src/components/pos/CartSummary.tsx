// =====================================================================
// CartSummary — สรุปยอด เลือกช่องทางชำระ และปุ่มยืนยันบิล (§5 หน้า 1)
// ตัวเลขทุกตัวในแผงนี้เป็น "ประมาณการเพื่อ UX" ตาม §7.3
// ยอดจริงมาจาก checkout_sale และถูกแสดงบนใบเสร็จ
// ปุ่มยืนยันบิลเป็นวัตถุที่เด่นที่สุดในหน้า: พื้นทึบ Royal ตัวอักษรขาว เต็มคอลัมน์ (§8)
//
// หน้านี้ไม่แสดง QR พร้อมเพย์โดยตั้งใจ — ตอนอยู่ในตะกร้ายังไม่มีบิล
// ยอดจึงเป็นเพียงประมาณการ ถ้าเอาไปทำ QR ลูกค้าจะโอนผิดยอดเมื่อมีโปรโมชั่น
// QR อยู่ที่หน้าใบเสร็จจุดเดียว ซึ่งใช้ยอดสุทธิจริงจากฐานข้อมูล
// =====================================================================
import { formatMoney } from "../../lib/money";
import { Button } from "../ui/Button";
import type { CartEstimate } from "../../lib/money";
import type { PaymentMethod } from "../../types/db";

type Props = {
  estimate: CartEstimate;
  vatRate: number;
  itemCount: number;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cashReceived: string;
  onCashReceivedChange: (value: string) => void;
  manualDiscount: string;
  onManualDiscountChange: (value: string) => void;
  isOwner: boolean;
  disabled: boolean;
  submitting: boolean;
  onConfirm: () => void;
};

export function CartSummary({
  estimate,
  vatRate,
  itemCount,
  paymentMethod,
  onPaymentMethodChange,
  cashReceived,
  onCashReceivedChange,
  manualDiscount,
  onManualDiscountChange,
  isOwner,
  disabled,
  submitting,
  onConfirm,
}: Props) {
  return (
    <div className="space-y-3">
      <dl className="space-y-1 text-ink">
        <div className="flex justify-between">
          <dt>ยอดก่อนภาษี (ประมาณการ)</dt>
          <dd className="num">{formatMoney(estimate.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>VAT {vatRate}%</dt>
          <dd className="num">{formatMoney(estimate.vatAmount)}</dd>
        </div>
        <div className="flex justify-between items-baseline border-t border-royal/20 pt-2">
          <dt className="font-medium">ยอดสุทธิ (ประมาณการ)</dt>
          <dd className="num font-display text-2xl font-bold text-royal">
            {formatMoney(estimate.totalAmount)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-ink/60">
        ส่วนลดและโปรโมชั่นคำนวณฝั่งเซิร์ฟเวอร์ ยอดจริงจะแสดงบนใบเสร็จหลังปิดบิล
      </p>

      <div>
        <p className="mb-1 font-medium">ช่องทางชำระ</p>
        <div className="grid grid-cols-2 gap-2">
          {(["cash", "promptpay"] as PaymentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onPaymentMethodChange(method)}
              className={[
                "min-h-touch rounded border",
                paymentMethod === method
                  ? "bg-royal text-paper border-royal font-medium"
                  : "bg-paper text-royal border-royal/30",
              ].join(" ")}
            >
              {method === "cash" ? "เงินสด" : "พร้อมเพย์"}
            </button>
          ))}
        </div>
      </div>

      {paymentMethod === "cash" && (
        <label className="block">
          <span className="block mb-1 font-medium">เงินที่รับมา</span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={cashReceived}
            onChange={(e) => onCashReceivedChange(e.target.value)}
            className="w-full min-h-touch num text-lg"
            placeholder="0.00"
          />
          <span className="block mt-1 text-xs text-ink/60">
            เงินทอนคำนวณฝั่งเซิร์ฟเวอร์และแสดงบนใบเสร็จ
          </span>
        </label>
      )}

      {paymentMethod === "promptpay" && (
        <p className="text-sm text-ink border border-royal/25 bg-powder/40 rounded p-3">
          กดยืนยันบิลก่อน ระบบจะแสดง QR พร้อมเพย์ยอดสุทธิจริงให้ลูกค้าสแกนที่หน้าใบเสร็จ
        </p>
      )}

      {isOwner && (
        <label className="block">
          <span className="block mb-1 font-medium">ส่วนลดกดมือ (บาท)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={manualDiscount}
            onChange={(e) => onManualDiscountChange(e.target.value)}
            className="w-full min-h-touch num"
            placeholder="0.00"
          />
          <span className="block mt-1 text-xs text-ink/60">
            สิทธิ์ของเจ้าของร้าน หักก่อนคิด VAT
          </span>
        </label>
      )}

      <Button
        variant="primary"
        fullWidth
        disabled={disabled || submitting}
        onClick={onConfirm}
        className="text-lg"
      >
        {submitting ? "กำลังปิดบิล…" : `ยืนยันบิล (${itemCount} ชิ้น)`}
      </Button>
    </div>
  );
}
