// =====================================================================
// หน้า 2 — ใบเสร็จ (§5)
// พรีวิว 58 มม. + ปุ่มพิมพ์ผ่านเบราว์เซอร์
// =====================================================================
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { confirmPayment, getSaleWithItems } from "../api/sales.api";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { errorMessage } from "../lib/supabase";
import { paths } from "../routes/paths";
import { Receipt58mm } from "../components/receipt/Receipt58mm";
import { PromptPayQR } from "../components/receipt/PromptPayQR";
import { formatMoney, parseMoney } from "../lib/money";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import type { SaleWithItems } from "../types/db";

export function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { settings } = useStoreSettings();
  const [sale, setSale] = useState<SaleWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  /** ยืนยันรับเงิน แล้วเปลี่ยนหน้าจอเป็น "ชำระเงินสำเร็จ" ด้วยค่าที่ฐานข้อมูลตอบกลับมาจริง */
  async function handleConfirmPayment() {
    if (!sale) return;
    setConfirming(true);
    try {
      const updated = await confirmPayment(sale.id);
      setSale({ ...sale, payment_confirmed_by: updated.payment_confirmed_by });
      setConfirmError(null);
    } catch (e) {
      setConfirmError(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    document.title = "ใบเสร็จ — Aunchan";
  }, []);

  useEffect(() => {
    if (!saleId) return;
    let active = true;

    setLoading(true);
    getSaleWithItems(saleId)
      .then((data) => {
        if (active) {
          setSale(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [saleId]);

  return (
    <div className="max-w-3xl mx-auto p-3">
      <div className="no-print">
        <PageHeader
          title="ใบเสร็จ"
          description="พรีวิวความกว้าง 58 มม. สั่งพิมพ์ผ่านเบราว์เซอร์"
          actions={
            <>
              <Button onClick={() => navigate(paths.pos)}>กลับหน้าขาย</Button>
              <Button variant="primary" onClick={() => window.print()} disabled={!sale}>
                พิมพ์ใบเสร็จ
              </Button>
            </>
          }
        />
      </div>

      {loading && <p className="text-royal">กำลังโหลดใบเสร็จ…</p>}

      {!loading && error && (
        <div className="no-print">
          <EmptyState title="เปิดใบเสร็จไม่ได้" description={error} />
        </div>
      )}

      {!loading && !error && !sale && (
        <div className="no-print">
          <EmptyState
            title="ไม่พบบิลนี้"
            description="บิลอาจถูกลบ หรือคุณไม่มีสิทธิ์ดูบิลของรอบขายอื่น"
            action={
              <Button variant="primary" onClick={() => navigate(paths.pos)}>
                กลับหน้าขาย
              </Button>
            }
          />
        </div>
      )}

      {/* บิลพร้อมเพย์: จุดเดียวของระบบที่แสดง QR ใช้ยอดสุทธิจริงจากแถว sales (§4 การชำระเงิน) */}
      {sale && sale.payment_method === "promptpay" && (
        <div className="panel p-4 mb-3 no-print">
          {sale.payment_confirmed_by ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={22} strokeWidth={1.5} className="text-success" aria-hidden />
                <h2 className="font-display text-xl text-success">ชำระเงินสำเร็จ</h2>
              </div>
              <p className="text-sm text-ink/70">
                บิล <span className="num">{sale.receipt_no}</span> ยอด{" "}
                <span className="num">{formatMoney(sale.total_amount)}</span> ยืนยันรับเงินแล้ว
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl text-royal mb-1">ชำระด้วยพร้อมเพย์</h2>
              <p className="text-sm text-ink/70 mb-3">
                บิล <span className="num">{sale.receipt_no}</span> · ตรวจสอบว่าเงินเข้าบัญชีจริงก่อนส่งของทุกครั้ง
              </p>
              <PromptPayQR
                promptpayId={settings?.promptpay_id ?? null}
                amount={parseMoney(sale.total_amount)}
              />

              {/* ปุ่มยืนยันรับเงิน แสดงทุกโหมดเพื่อให้ทดสอบบน production ได้
                  เงื่อนไขเดียวคือบิลนี้ยังไม่มีคนยืนยัน (อยู่ในกิ่ง else ของ payment_confirmed_by)
                  ป้ายกำกับต่างกันตามโหมด เพื่อไม่ให้แคชเชียร์เห็นคำว่า "จำลอง" บนเครื่องจริง */}
              <div className="mt-3 pt-3 border-t border-royal/20">
                <Button variant="primary" onClick={() => void handleConfirmPayment()} disabled={confirming}>
                  {confirming
                    ? "กำลังยืนยัน…"
                    : import.meta.env.DEV
                      ? "[Dev] จำลองโอนเงินสำเร็จ"
                      : "ยืนยันว่าได้รับเงินแล้ว"}
                </Button>
                <p className="text-xs text-ink/60 mt-1">
                  กดเมื่อเห็นเงินเข้าบัญชีจริงแล้วเท่านั้น ระบบจะบันทึกว่าใครเป็นคนยืนยันและยืนยันเมื่อไร
                </p>
                {confirmError && <p className="text-danger text-sm mt-1">{confirmError}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {sale && <Receipt58mm sale={sale} settings={settings} />}
    </div>
  );
}
