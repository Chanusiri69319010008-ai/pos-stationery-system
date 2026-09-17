// =====================================================================
// หน้า 2 — ใบเสร็จ (§5)
// พรีวิว 58 มม. + ปุ่มพิมพ์ผ่านเบราว์เซอร์
// =====================================================================
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSaleWithItems } from "../api/sales.api";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { errorMessage } from "../lib/supabase";
import { paths } from "../routes/paths";
import { Receipt58mm } from "../components/receipt/Receipt58mm";
import { PromptPayQR } from "../components/receipt/PromptPayQR";
import { parseMoney } from "../lib/money";
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
          <h2 className="font-display text-xl text-royal mb-1">ชำระด้วยพร้อมเพย์</h2>
          <p className="text-sm text-ink/70 mb-3">
            บิล <span className="num">{sale.receipt_no}</span> · ตรวจสอบว่าเงินเข้าบัญชีจริงก่อนส่งของทุกครั้ง
          </p>
          <PromptPayQR
            promptpayId={settings?.promptpay_id ?? null}
            amount={parseMoney(sale.total_amount)}
          />
        </div>
      )}

      {sale && <Receipt58mm sale={sale} settings={settings} />}
    </div>
  );
}
