// =====================================================================
// หน้า 12 (ส่วนรอบขาย) — เปิด/ปิดรอบขาย (§5, §4 รอบขาย, §7.7)
// ยอดสรุปทั้งหมดมาจาก view shift_summary ฝั่งเซิร์ฟเวอร์
// ผลต่างเงินสดถูกบันทึกลงฐานข้อมูลโดย close_shift ไม่ใช่แค่แสดงบนจอ
// =====================================================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShift } from "../hooks/useShift";
import { errorMessage } from "../lib/supabase";
import { formatMoney, parseMoney } from "../lib/money";
import { formatDateTime } from "../lib/datetime";
import { paths } from "../routes/paths";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toast";

export function ShiftPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { shift, summary, loading, refresh, open, close } = useShift();

  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [confirm, setConfirm] = useState<"open" | "close" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "รอบขาย — Aunchan";
  }, []);

  async function handleOpen() {
    setBusy(true);
    try {
      const created = await open(Number(openingCash || 0));
      showToast(
        `เปิดรอบขายแล้ว เงินตั้งต้นในลิ้นชัก ${formatMoney(created.opening_cash)}`,
        "success",
      );
      setOpeningCash("");
      setConfirm(null);
      navigate(paths.pos);
    } catch (e) {
      showToast(errorMessage(e), "error");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!shift) return;
    setBusy(true);
    try {
      const closed = await close(shift.id, Number(countedCash || 0));
      const diff = parseMoney(closed.cash_diff);
      showToast(
        `ปิดรอบขายแล้ว เงินที่ควรมี ${formatMoney(closed.expected_cash)} · นับได้ ${formatMoney(
          closed.counted_cash,
        )} · ผลต่าง ${formatMoney(diff)}`,
        diff === 0 ? "success" : "info",
      );
      setCountedCash("");
      setConfirm(null);
      await refresh();
    } catch (e) {
      showToast(errorMessage(e), "error");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-royal">กำลังโหลดรอบขาย…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-3">
      <PageHeader
        title="รอบขาย"
        description="ขายได้เฉพาะเมื่อมีรอบขายที่เปิดอยู่ของคุณ"
      />

      {!shift && (
        <div className="panel p-4 space-y-4">
          <p className="text-ink/70">
            ยังไม่มีรอบขายที่เปิดอยู่ กรอกเงินตั้งต้นในลิ้นชักแล้วกดเปิดรอบขายเพื่อเริ่มขาย
          </p>

          <label className="block">
            <span className="block mb-1 font-medium">เงินตั้งต้นในลิ้นชัก (บาท)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              className="w-full min-h-touch num text-lg"
              placeholder="0.00"
            />
          </label>

          <Button variant="primary" fullWidth onClick={() => setConfirm("open")}>
            เปิดรอบขาย
          </Button>
        </div>
      )}

      {shift && (
        <div className="space-y-3">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl text-royal">รอบขายที่เปิดอยู่</h2>
              <StatusBadge>เปิดอยู่</StatusBadge>
            </div>
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt>เปิดเมื่อ</dt>
                <dd className="num">{formatDateTime(shift.opened_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>เงินตั้งต้นในลิ้นชัก</dt>
                <dd className="num">{formatMoney(shift.opening_cash)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>จำนวนบิล</dt>
                <dd className="num">{summary?.bill_count ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ยอดขายเงินสด</dt>
                <dd className="num">{formatMoney(summary?.cash_sales ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ยอดขายพร้อมเพย์</dt>
                <dd className="num">{formatMoney(summary?.promptpay_sales ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-t border-royal/20 pt-1">
                <dt className="font-medium">ยอดขายรวม</dt>
                <dd className="num font-medium">{formatMoney(summary?.total_sales ?? 0)}</dd>
              </div>
            </dl>
          </div>

          <div className="panel p-4 space-y-4">
            <h2 className="font-display text-xl text-royal">ปิดรอบขาย</h2>
            <p className="text-ink/70">
              นับเงินสดในลิ้นชักทั้งหมดแล้วกรอกยอดที่นับได้ ระบบจะบันทึกผลต่างลงฐานข้อมูล
            </p>

            <label className="block">
              <span className="block mb-1 font-medium">เงินสดที่นับได้ (บาท)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="w-full min-h-touch num text-lg"
                placeholder="0.00"
              />
            </label>

            <Button variant="primary" fullWidth onClick={() => setConfirm("close")}>
              ปิดรอบขาย
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "open"}
        title="ยืนยันเปิดรอบขาย"
        busy={busy}
        confirmLabel="เปิดรอบขาย"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleOpen()}
        message={
          <p>
            เปิดรอบขายด้วยเงินตั้งต้น{" "}
            <span className="num font-medium">{formatMoney(Number(openingCash || 0))}</span>
          </p>
        }
      />

      <ConfirmDialog
        open={confirm === "close"}
        title="ยืนยันปิดรอบขาย"
        busy={busy}
        confirmLabel="ปิดรอบขาย"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleClose()}
        message={
          <div className="space-y-1">
            <p>
              เงินสดที่นับได้{" "}
              <span className="num font-medium">{formatMoney(Number(countedCash || 0))}</span>
            </p>
            <p className="text-xs text-ink/60">
              ปิดแล้วจะขายในรอบนี้ต่อไม่ได้ และผลต่างเงินสดจะถูกบันทึกไว้ถาวร
            </p>
          </div>
        }
      />
    </div>
  );
}
