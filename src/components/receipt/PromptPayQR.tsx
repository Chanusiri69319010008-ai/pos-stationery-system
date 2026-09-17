// =====================================================================
// PromptPayQR — QR พร้อมเพย์บนหน้าใบเสร็จ (§4 การชำระเงิน)
//
// จุดเดียวของทั้งระบบที่แสดง QR — ใช้ sales.total_amount ซึ่งเป็นยอดที่
// เซิร์ฟเวอร์คำนวณและบันทึกไว้แล้ว จึงตรงกับบิลเสมอ
// หน้าขายไม่แสดง QR เพราะตอนนั้นบิลยังไม่เกิด ยอดยังเป็นเพียงประมาณการ (§7.3)
//
// ระบบไม่รู้ว่าเงินเข้าจริงหรือไม่ แคชเชียร์ต้องตรวจสอบเอง
// และผู้ที่กดออกบิลถูกบันทึกไว้ที่ sales.payment_confirmed_by
// =====================================================================
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildPromptPayPayload } from "../../lib/promptpay";
import { formatMoney } from "../../lib/money";

export function PromptPayQR({
  promptpayId,
  amount,
}: {
  promptpayId: string | null;
  /** ยอดสุทธิจากแถว sales ที่บันทึกแล้วเท่านั้น ห้ามส่งค่าประมาณการเข้ามา */
  amount: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!promptpayId) {
      setError("ยังไม่ได้ตั้งค่าพร้อมเพย์ในข้อมูลร้าน — ลูกค้าต้องชำระด้วยวิธีอื่น");
      setDataUrl(null);
      return;
    }

    try {
      const payload = buildPromptPayPayload(promptpayId, amount);
      QRCode.toDataURL(payload, { margin: 1, width: 260 })
        .then((url) => {
          if (active) {
            setDataUrl(url);
            setError(null);
          }
        })
        .catch(() => {
          if (active) setError("สร้าง QR ไม่สำเร็จ");
        });
    } catch (e) {
      setError((e as Error).message);
      setDataUrl(null);
    }

    return () => {
      active = false;
    };
  }, [promptpayId, amount]);

  if (error) {
    return <p className="text-warning border border-warning/40 rounded p-3">{error}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-center text-ink">
        กรุณาสแกน QR Code เพื่อชำระยอดสุทธิ{" "}
        <span className="num font-display text-2xl font-bold text-royal align-middle">
          {formatMoney(amount)}
        </span>
      </p>

      {dataUrl ? (
        <img src={dataUrl} alt={`QR พร้อมเพย์ ยอด ${formatMoney(amount)}`} className="w-56 h-56" />
      ) : (
        <div className="w-56 h-56 flex items-center justify-center text-ink/60">
          กำลังสร้าง QR…
        </div>
      )}

      <p className="text-xs text-ink/60 text-center">
        ยอดในคิวอาร์ตรงกับยอดสุทธิของบิลนี้ ลูกค้าสแกนแล้วจ่ายได้ทันทีโดยไม่ต้องกรอกจำนวนเงิน
      </p>
    </div>
  );
}
