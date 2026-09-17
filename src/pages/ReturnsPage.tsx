// =====================================================================
// หน้า 9 — คืนสินค้า / ยกเลิกบิล (owner เท่านั้น) (§5)
// ทั้งสองอย่างทำผ่าน RPC create_return และ void_sale ในธุรกรรมเดียว
// หน้าเว็บไม่คิดเงินคืนเอง และไม่แตะสต็อกเอง (§7.1, §7.3)
// เปิดจากหน้าประวัติการขายได้ด้วย /returns?sale=<id>
// =====================================================================
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useReturns } from "../hooks/useReturns";
import { errorMessage } from "../lib/supabase";
import { formatMoney } from "../lib/money";
import { formatDateTime } from "../lib/datetime";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toast";
import { ReturnHistory } from "../components/returns/ReturnHistory";
import { ReturnItemsForm, type ReturnDraft } from "../components/returns/ReturnItemsForm";
import type { ReturnItemInput, SaleStatus } from "../types/db";

const statusLabel: Record<SaleStatus, string> = {
  completed: "สำเร็จ",
  voided: "ยกเลิกแล้ว",
  partially_returned: "คืนบางส่วน",
  returned: "คืนครบแล้ว",
};

export function ReturnsPage() {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const { sale, history, loading, error, search, loadById, clear, submitReturn, submitVoid } =
    useReturns();

  const [receiptNo, setReceiptNo] = useState("");
  const [draft, setDraft] = useState<ReturnDraft>({});
  const [reason, setReason] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "คืนสินค้า — Aunchan";
  }, []);

  // เปิดหน้านี้จากลิงก์ในประวัติการขาย
  const saleIdParam = params.get("sale");
  useEffect(() => {
    if (saleIdParam) void loadById(saleIdParam);
  }, [saleIdParam, loadById]);

  // บิลเปลี่ยน = ล้างร่างใบคืนเดิมทิ้ง
  useEffect(() => {
    setDraft({});
    setReason("");
    setVoidReason("");
    setFormError(null);
  }, [sale?.id, sale?.status]);

  const nameOf = useMemo(() => {
    const byId = new Map(
      (sale?.sale_items ?? []).map((item) => [item.id, item.products?.name ?? "-"]),
    );
    return (saleItemId: string) => byId.get(saleItemId) ?? "-";
  }, [sale]);

  const canReturn = sale !== null && sale.status !== "voided" && sale.status !== "returned";
  const canVoid = sale !== null && sale.status === "completed" && history.length === 0;

  function updateDraft(saleItemId: string, patch: { quantity?: string; restock?: boolean }) {
    setDraft((current) => {
      const row = current[saleItemId] ?? { quantity: "", restock: true };
      return { ...current, [saleItemId]: { ...row, ...patch } };
    });
  }

  /** แปลงร่างบนหน้าจอเป็นพารามิเตอร์ของ RPC — ไม่มีการคิดเงินตรงนี้ */
  function draftToItems(): ReturnItemInput[] {
    const items: ReturnItemInput[] = [];
    for (const [saleItemId, row] of Object.entries(draft)) {
      const quantity = Number(row.quantity);
      if (Number.isFinite(quantity) && quantity > 0) {
        items.push({ sale_item_id: saleItemId, quantity, restock: row.restock });
      }
    }
    return items;
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (receiptNo.trim() === "") return;
    setParams({});
    void search(receiptNo);
  }

  function openConfirmReturn() {
    if (draftToItems().length === 0) {
      setFormError("ใส่จำนวนที่จะคืนอย่างน้อย 1 รายการ");
      return;
    }
    if (reason.trim() === "") {
      setFormError("ต้องระบุเหตุผลในการคืนสินค้า");
      return;
    }
    setFormError(null);
    setConfirmReturn(true);
  }

  async function doReturn() {
    setBusy(true);
    try {
      const result = await submitReturn(draftToItems(), reason.trim());
      showToast(
        `คืนสินค้าบิล ${result.receipt_no} แล้ว คืนเงิน ${formatMoney(result.refund_amount)} (${
          result.refund_method === "cash" ? "เงินสด" : "พร้อมเพย์"
        })`,
        "success",
      );
      setConfirmReturn(false);
      setDraft({});
      setReason("");
    } catch (e) {
      showToast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  function openConfirmVoid() {
    if (voidReason.trim() === "") {
      setFormError("ต้องระบุเหตุผลในการยกเลิกบิล");
      return;
    }
    setFormError(null);
    setConfirmVoid(true);
  }

  async function doVoid() {
    setBusy(true);
    try {
      const voided = await submitVoid(voidReason.trim());
      showToast(`ยกเลิกบิล ${voided.receipt_no} แล้ว สินค้าถูกคืนเข้าสต็อกครบทุกชิ้น`, "success");
      setConfirmVoid(false);
      setVoidReason("");
    } catch (e) {
      showToast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-3">
      <PageHeader
        title="คืนสินค้า / ยกเลิกบิล"
        description="ค้นหาบิลด้วยเลขที่บิล แล้วเลือกรายการที่ลูกค้านำมาคืน"
      />

      <form onSubmit={handleSearch} className="panel p-3 mb-3 flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-[220px]">
          <span className="block mb-1 text-sm">เลขที่บิล</span>
          <input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="เช่น INV-2026-000012"
            autoFocus
            className="w-full min-h-touch num"
          />
        </label>
        <Button variant="primary" type="submit">
          ค้นหาบิล
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            setReceiptNo("");
            setParams({});
            clear();
          }}
        >
          ล้าง
        </Button>
      </form>

      {loading && <p className="text-royal">กำลังโหลด…</p>}

      {!loading && error && <EmptyState title="เปิดบิลไม่สำเร็จ" description={error} />}

      {!loading && !error && !sale && (
        <EmptyState
          title="ยังไม่ได้เลือกบิล"
          description="พิมพ์เลขที่บิลจากใบเสร็จของลูกค้า หรือกดปุ่มคืนสินค้าในหน้าประวัติการขาย"
        />
      )}

      {!loading && sale && (
        <>
          <div className="panel p-4 mb-3 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="font-display text-xl text-royal num">{sale.receipt_no}</p>
              <p className="text-sm num">{formatDateTime(sale.created_at)}</p>
              <p className="text-sm">พนักงาน: {sale.staff?.name ?? "-"}</p>
            </div>
            <div className="sm:text-right">
              <StatusBadge tone={sale.status === "completed" ? "default" : "warning"}>
                {statusLabel[sale.status]}
              </StatusBadge>
              <p className="num text-lg font-medium mt-1">{formatMoney(sale.total_amount)}</p>
              <p className="text-sm text-ink/70">
                ชำระโดย {sale.payment_method === "cash" ? "เงินสด" : "พร้อมเพย์"} · VAT{" "}
                <span className="num">{formatMoney(sale.vat_amount)}</span>
              </p>
            </div>
          </div>

          {sale.status === "voided" && (
            <EmptyState
              title="บิลนี้ถูกยกเลิกไปแล้ว"
              description="สินค้าถูกคืนเข้าสต็อกครบตั้งแต่ตอนยกเลิก จึงคืนสินค้าซ้ำไม่ได้"
            />
          )}

          {canReturn && (
            <>
              <ReturnItemsForm sale={sale} draft={draft} onChange={updateDraft} />

              <div className="panel p-3 mt-3 grid gap-2 sm:grid-cols-[1fr_auto] items-end">
                <label className="block">
                  <span className="block mb-1 text-sm">เหตุผลในการคืน</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="เช่น ลูกค้าเปลี่ยนใจ / สินค้าชำรุด"
                    className="w-full min-h-touch"
                  />
                  {sale.payment_method === "cash" && (
                    <span className="block mt-1 text-xs text-ink/60">
                      บิลนี้จ่ายเงินสด ต้องมีรอบขายเปิดอยู่ เพราะเงินที่คืนจะถูกหักออกจากลิ้นชักของรอบนั้น
                    </span>
                  )}
                </label>
                <Button variant="primary" onClick={openConfirmReturn} disabled={busy}>
                  ยืนยันการคืน
                </Button>
              </div>
            </>
          )}

          {sale.status === "returned" && (
            <EmptyState
              title="บิลนี้คืนครบทุกชิ้นแล้ว"
              description="ดูรายละเอียดการคืนได้จากประวัติด้านล่าง"
            />
          )}

          {formError && (
            <p className="text-danger border border-danger/40 rounded px-3 py-2 mt-3">{formError}</p>
          )}

          <ReturnHistory history={history} nameOf={nameOf} />

          {canVoid && (
            <div className="panel p-4 mt-3 border-danger/30">
              <h2 className="font-display text-xl text-royal mb-1">ยกเลิกบิลทั้งใบ</h2>
              <p className="text-sm text-ink/70 mb-3">
                ใช้กับบิลที่กดผิดหรือยังไม่ได้รับเงิน สินค้าทุกชิ้นจะถูกคืนเข้าสต็อก
                บิลยังอยู่ในประวัติแต่จะไม่ถูกนับเป็นยอดขาย · ทำได้เฉพาะตอนที่รอบขายของบิลยังไม่ปิด
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
                <label className="block">
                  <span className="block mb-1 text-sm">เหตุผลในการยกเลิก</span>
                  <input
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="เช่น กดขายผิดรายการ"
                    className="w-full min-h-touch"
                  />
                </label>
                <Button variant="danger" onClick={openConfirmVoid} disabled={busy}>
                  ยกเลิกบิลนี้
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmReturn}
        title="ยืนยันการคืนสินค้า"
        busy={busy}
        confirmLabel="ยืนยันคืนสินค้า"
        onCancel={() => setConfirmReturn(false)}
        onConfirm={() => void doReturn()}
        message={
          <div className="space-y-2">
            <p>คืนสินค้าของบิล {sale?.receipt_no} จำนวน {draftToItems().length} รายการ</p>
            <ul className="text-sm list-disc pl-5">
              {draftToItems().map((item) => (
                <li key={item.sale_item_id}>
                  {nameOf(item.sale_item_id)} × {item.quantity}
                  {!item.restock && " (ไม่คืนเข้าสต็อก)"}
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink/70">
              ระบบจะคำนวณยอดเงินคืนตามส่วนลดและ VAT ของบิลนี้ แล้วแจ้งยอดจริงหลังยืนยัน
            </p>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmVoid}
        title="ยืนยันยกเลิกบิล"
        busy={busy}
        confirmLabel="ยกเลิกบิล"
        onCancel={() => setConfirmVoid(false)}
        onConfirm={() => void doVoid()}
        message={
          <p>
            บิล {sale?.receipt_no} ยอด {formatMoney(sale?.total_amount ?? 0)} จะถูกทำเครื่องหมายว่า
            "ยกเลิก" และสินค้าทุกชิ้นจะถูกคืนเข้าสต็อก การยกเลิกย้อนกลับไม่ได้
          </p>
        }
      />
    </div>
  );
}
