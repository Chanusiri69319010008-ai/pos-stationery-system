// =====================================================================
// หน้า 1 — ขายสินค้า (POS)  (§5 หน้า 1, §8 หลักการหน้าจอ)
// ลำดับบนจอ: TopIconDock → ช่องสแกน → ตะกร้า/สินค้า
// ตะกร้ากับยอดสุทธิต้องเห็นพร้อมกัน บนมือถือยอดสุทธิติดขอบล่าง
// ตัวเลขบนหน้านี้เป็นประมาณการ ค่าจริงมาจาก checkout_sale (§7.3)
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useProducts } from "../hooks/useProducts";
import { useShift } from "../hooks/useShift";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { errorMessage } from "../lib/supabase";
import { formatMoney, parseMoney } from "../lib/money";
import { paths } from "../routes/paths";
import { ScanBar } from "../components/pos/ScanBar";
import { ProductGrid } from "../components/pos/ProductGrid";
import { CartList } from "../components/pos/CartList";
import { CartSummary } from "../components/pos/CartSummary";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import type { PaymentMethod, ProductWithStock } from "../types/db";

export function POSPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isOwner } = useAuth();
  const { settings } = useStoreSettings();
  const { shift, loading: shiftLoading, refresh: refreshShift } = useShift();
  const { products, categories, loading: productsLoading, refresh: refreshProducts } = useProducts({
    activeOnly: true,
  });

  const vatRate = parseMoney(settings?.vat_rate ?? 7);
  const cart = useCart(vatRate);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [manualDiscount, setManualDiscount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  useEffect(() => {
    document.title = "ขายสินค้า — Aunchan";
  }, []);

  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter((product) => {
      const inCategory = category === "ทั้งหมด" || product.category === category;
      const matches =
        keyword === "" ||
        product.name.toLowerCase().includes(keyword) ||
        product.sku.toLowerCase().includes(keyword) ||
        (product.barcode ?? "").toLowerCase().includes(keyword);
      return inCategory && matches;
    });
  }, [products, search, category]);

  function pickProduct(product: ProductWithStock) {
    cart.addProduct(product, product.quantity);
  }

  /** เครื่องสแกนยิงบาร์โค้ดจบด้วย Enter — หาในรายการที่โหลดมาแล้วก่อน */
  function handleScan(code: string) {
    const needle = code.trim().toLowerCase();
    const found =
      products.find((p) => (p.barcode ?? "").toLowerCase() === needle) ??
      products.find((p) => p.sku.toLowerCase() === needle);

    if (found) {
      pickProduct(found);
      setSearch("");
      return;
    }

    const matches = products.filter((p) => p.name.toLowerCase().includes(needle));
    if (matches.length === 1) {
      pickProduct(matches[0]);
      setSearch("");
      return;
    }

    if (matches.length === 0) {
      showToast(`ไม่พบสินค้าที่ตรงกับ "${code}"`, "error");
      setSearch("");
    }
  }

  async function submitSale() {
    if (!shift) return;

    try {
      const sale = await cart.submit({
        shiftId: shift.id,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? Number(cashReceived || 0) : null,
        manualDiscount: isOwner ? Number(manualDiscount || 0) : 0,
      });

      // ตัวเลขใน toast มาจากแถว sales ที่บันทึกจริง ไม่ใช่ค่าประมาณการบนจอ (§8)
      showToast(
        `บันทึกบิล ${sale.receipt_no} ยอดสุทธิ ${formatMoney(sale.total_amount)}` +
          (sale.cash_change !== null ? ` เงินทอน ${formatMoney(sale.cash_change)}` : ""),
        "success",
      );

      cart.clear();
      setCashReceived("");
      setManualDiscount("");
      setConfirmOpen(false);
      setPaymentSheetOpen(false);
      await Promise.all([refreshProducts(), refreshShift()]);
      navigate(paths.receiptOf(sale.id));
    } catch (e) {
      setConfirmOpen(false);
      showToast(errorMessage(e), "error");
    }
  }

  const summaryProps = {
    estimate: cart.estimate,
    vatRate,
    itemCount: cart.itemCount,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    cashReceived,
    onCashReceivedChange: setCashReceived,
    manualDiscount,
    onManualDiscountChange: setManualDiscount,
    isOwner,
    disabled: cart.lines.length === 0,
    submitting: cart.submitting,
    onConfirm: () => setConfirmOpen(true),
  };

  if (shiftLoading) {
    return <div className="p-4 text-royal">กำลังตรวจสอบรอบขาย…</div>;
  }

  if (!shift) {
    return (
      <div className="p-4 max-w-xl mx-auto">
        <EmptyState
          title="ยังไม่ได้เปิดรอบขาย"
          description="ระบบขายได้เฉพาะเมื่อมีรอบขายที่เปิดอยู่ของคุณ เปิดรอบขายพร้อมกรอกเงินตั้งต้นในลิ้นชักก่อนเริ่มขาย"
          action={
            <Button variant="primary" onClick={() => navigate(paths.shift)}>
              ไปที่หน้ารอบขาย
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-24 lg:pb-0">
      <ScanBar
        value={search}
        onChange={setSearch}
        onSubmit={handleScan}
        paused={confirmOpen || paymentSheetOpen}
      />

      <div className="max-w-6xl mx-auto p-3 grid gap-3 lg:grid-cols-[1fr_360px]">
        <section aria-label="รายการสินค้า">
          {productsLoading ? (
            <p className="text-royal p-4">กำลังโหลดสินค้า…</p>
          ) : products.length === 0 ? (
            <EmptyState
              title="ยังไม่มีสินค้าในระบบ"
              description="ให้เจ้าของร้านเพิ่มสินค้าที่หน้าจัดการสินค้าก่อน จึงจะเริ่มขายได้"
            />
          ) : (
            <ProductGrid
              products={visibleProducts}
              categories={categories}
              activeCategory={category}
              onCategoryChange={setCategory}
              onPick={pickProduct}
            />
          )}
        </section>

        <aside className="lg:sticky lg:top-[7.5rem] lg:self-start space-y-3">
          <div className="panel p-3">
            <h2 className="font-display text-xl text-royal mb-2">ตะกร้า</h2>
            <CartList
              lines={cart.lines}
              onSetQuantity={cart.setQuantity}
              onRemove={cart.removeLine}
            />
          </div>

          <div className="panel p-3 hidden lg:block">
            <CartSummary {...summaryProps} />
          </div>
        </aside>
      </div>

      {/* มือถือ/แท็บเล็ต: ยอดสุทธิติดขอบล่างเสมอ (§8) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-paper border-t border-royal/25 p-3 no-print">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink/60">ยอดสุทธิ (ประมาณการ)</p>
            <p className="num font-display text-2xl font-bold text-royal">
              {formatMoney(cart.estimate.totalAmount)}
            </p>
          </div>
          <Button
            variant="primary"
            disabled={cart.lines.length === 0}
            onClick={() => setPaymentSheetOpen(true)}
            className="text-lg"
          >
            ชำระเงิน ({cart.itemCount} ชิ้น)
          </Button>
        </div>
      </div>

      <Modal
        open={paymentSheetOpen}
        title="ชำระเงิน"
        onClose={() => setPaymentSheetOpen(false)}
      >
        <CartSummary {...summaryProps} />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันบิล"
        busy={cart.submitting}
        confirmLabel="ยืนยันบิล"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submitSale()}
        message={
          <div className="space-y-1">
            <p>
              จำนวน <span className="num">{cart.itemCount}</span> ชิ้น ·{" "}
              {paymentMethod === "cash" ? "เงินสด" : "พร้อมเพย์"}
            </p>
            <p>
              ยอดสุทธิโดยประมาณ{" "}
              <span className="num font-medium">{formatMoney(cart.estimate.totalAmount)}</span>
            </p>
            {paymentMethod === "cash" && (
              <p>
                เงินที่รับ <span className="num">{formatMoney(Number(cashReceived || 0))}</span>
              </p>
            )}
            {paymentMethod === "promptpay" && (
              <p>
                ออกบิลแล้วระบบจะพาไปหน้าใบเสร็จ พร้อมแสดง QR ยอดสุทธิจริงให้ลูกค้าสแกนจ่าย
              </p>
            )}
            <p className="text-xs text-ink/60">
              ยอดจริงคำนวณที่เซิร์ฟเวอร์และจะแสดงบนใบเสร็จหลังบันทึก
            </p>
          </div>
        }
      />
    </div>
  );
}
