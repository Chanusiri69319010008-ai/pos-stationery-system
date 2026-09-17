// =====================================================================
// หน้า 7 — จัดการสต็อก / รับสินค้าเข้า (owner เท่านั้น) (§5)
// 3 ส่วนตามสเปก: รับสินค้าเข้า · ปรับยอด (ต้องมีเหตุผล) · ประวัติการเคลื่อนไหว
// ทุกการกระทำที่เปลี่ยนสต็อกมี confirm dialog และ toast ที่บอกตัวเลขจริงที่บันทึกไป (§8)
// =====================================================================
import { useEffect, useState, type ReactNode } from "react";
import { useProducts } from "../hooks/useProducts";
import { useStockManage } from "../hooks/useStockManage";
import { errorMessage } from "../lib/supabase";
import { formatMoney } from "../lib/money";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { LowStockBanner } from "../components/stock/LowStockBanner";
import { ReceiveStockForm } from "../components/stock/ReceiveStockForm";
import { AdjustStockForm, type StockChangeMode } from "../components/stock/AdjustStockForm";
import { MovementHistory } from "../components/stock/MovementHistory";
import type { ReceiveItem } from "../api/stock.api";
import type { MovementType, Uuid } from "../types/db";

type Tab = "receive" | "adjust" | "history";

type PendingReceive = { kind: "receive"; supplierId: Uuid | null; items: ReceiveItem[] };
type PendingChange = {
  kind: "change";
  mode: StockChangeMode;
  productId: Uuid;
  value: number;
  reason: string;
};
type Pending = PendingReceive | PendingChange | null;

export function StockManagePage() {
  const { showToast } = useToast();
  const { products, lowStock, loading: productsLoading, refresh: refreshProducts } = useProducts({
    withCost: true,
  });
  const stock = useStockManage();

  const [tab, setTab] = useState<Tab>("receive");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    document.title = "จัดการสต็อก — Aunchan";
  }, []);

  function nameOf(productId: Uuid): string {
    return products.find((p) => p.id === productId)?.name ?? "สินค้า";
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);

    try {
      if (pending.kind === "receive") {
        const rows = await stock.receive(pending.supplierId, pending.items);
        showToast(
          `รับสินค้าเข้าแล้ว ${rows.length} รายการ · ` +
            rows
              .map(
                (r) =>
                  `${r.sku} +${r.received} (คงเหลือ ${r.quantity} · ต้นทุนเฉลี่ย ${formatMoney(
                    r.cost_price,
                  )})`,
              )
              .join(" · "),
          "success",
        );
      } else if (pending.mode === "adjust") {
        const result = await stock.adjust(pending.productId, pending.value, pending.reason);
        showToast(
          `ปรับยอด ${result.name} จาก ${result.old_quantity} เป็น ${result.new_quantity} ` +
            `(${result.qty_change > 0 ? "+" : ""}${result.qty_change})`,
          "success",
        );
      } else {
        const result = await stock.waste(pending.productId, pending.value, pending.reason);
        showToast(
          `บันทึกของเสีย ${result.name} ${result.wasted} ชิ้น · คงเหลือ ${result.quantity_after}`,
          "success",
        );
      }

      setPending(null);
      await Promise.all([refreshProducts(), stock.refreshMovements()]);
    } catch (e) {
      showToast(errorMessage(e), "error");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "receive", label: "รับสินค้าเข้า" },
    { id: "adjust", label: "ปรับยอด / ของเสีย" },
    { id: "history", label: "ประวัติการเคลื่อนไหว" },
  ];

  let confirmMessage: ReactNode = null;
  if (pending?.kind === "receive") {
    confirmMessage = (
      <div className="space-y-1">
        <p>รับสินค้าเข้า {pending.items.length} รายการ</p>
        <ul className="list-disc pl-5">
          {pending.items.map((item) => (
            <li key={item.product_id} className="num">
              {nameOf(item.product_id)} × {item.quantity} @ {formatMoney(item.unit_cost)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink/60">
          ต้นทุนถัวเฉลี่ยของสินค้าเหล่านี้จะถูกคำนวณใหม่ และสต็อกจะเพิ่มขึ้นทันที
        </p>
      </div>
    );
  } else if (pending?.kind === "change") {
    confirmMessage = (
      <div className="space-y-1">
        <p>
          {pending.mode === "adjust"
            ? `ปรับยอด ${nameOf(pending.productId)} เป็น ${pending.value} ชิ้น`
            : `บันทึกของเสีย ${nameOf(pending.productId)} จำนวน ${pending.value} ชิ้น`}
        </p>
        <p>เหตุผล: {pending.reason}</p>
        <p className="text-xs text-ink/60">รายการนี้จะถูกบันทึกในประวัติการเคลื่อนไหวถาวร</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3">
      <PageHeader
        title="จัดการสต็อก"
        description="รับสินค้าเข้า ปรับยอดให้ตรงของจริง และดูประวัติการเคลื่อนไหวทั้งหมด"
      />

      <LowStockBanner items={lowStock} />

      <div className="flex gap-1 overflow-x-auto mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "shrink-0 min-h-touch px-4 rounded border",
              tab === t.id
                ? "bg-royal text-paper border-royal font-medium"
                : "bg-paper text-royal border-royal/30",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {productsLoading && <p className="text-royal">กำลังโหลดสินค้า…</p>}

      {!productsLoading && products.length === 0 && (
        <EmptyState
          title="ยังไม่มีสินค้าในระบบ"
          description="เพิ่มสินค้าที่หน้าจัดการสินค้าก่อน จึงจะรับสินค้าเข้าสต็อกได้"
        />
      )}

      {!productsLoading && products.length > 0 && tab === "receive" && (
        <ReceiveStockForm
          products={products}
          suppliers={stock.suppliers}
          busy={busy}
          onSubmit={(supplierId, items) => setPending({ kind: "receive", supplierId, items })}
        />
      )}

      {!productsLoading && products.length > 0 && tab === "adjust" && (
        <AdjustStockForm
          products={products}
          busy={busy}
          onSubmit={(mode, productId, value, reason) =>
            setPending({ kind: "change", mode, productId, value, reason })
          }
        />
      )}

      {tab === "history" && (
        <MovementHistory
          movements={stock.movements}
          products={products}
          loading={stock.loading}
          productId={productFilter}
          type={typeFilter}
          onFilterChange={({ productId, type }) => {
            setProductFilter(productId);
            setTypeFilter(type);
            stock.setFilter({
              productId: productId === "" ? null : productId,
              type: type === "" ? null : (type as MovementType),
              limit: 100,
            });
          }}
        />
      )}

      {stock.error && tab === "history" && (
        <p className="text-danger mt-2">{stock.error}</p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "receive"
            ? "ยืนยันรับสินค้าเข้า"
            : pending?.mode === "adjust"
              ? "ยืนยันปรับยอดสต็อก"
              : "ยืนยันบันทึกของเสีย"
        }
        busy={busy}
        confirmLabel="ยืนยัน"
        message={confirmMessage}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmPending()}
      />

      <div className="mt-4">
        <Button variant="ghost" onClick={() => void stock.refreshMovements()}>
          โหลดข้อมูลใหม่
        </Button>
      </div>
    </div>
  );
}
