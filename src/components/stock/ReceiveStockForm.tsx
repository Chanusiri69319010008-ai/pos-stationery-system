// =====================================================================
// ReceiveStockForm — รับสินค้าเข้า (§5 หน้า 7)
// เลือกซัพพลายเออร์ ใส่จำนวนและต้นทุนต่อหน่วยของแต่ละรายการ
// ต้นทุนถัวเฉลี่ยใหม่คำนวณที่ RPC receive_stock ไม่ใช่ที่นี่ (§4, §7.3)
// =====================================================================
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney, parseMoney } from "../../lib/money";
import { Button } from "../ui/Button";
import type { ReceiveItem } from "../../api/stock.api";
import type { ProductWithStock, Supplier, Uuid } from "../../types/db";

type DraftLine = {
  product_id: Uuid | "";
  quantity: string;
  unit_cost: string;
};

const emptyLine: DraftLine = { product_id: "", quantity: "", unit_cost: "" };

export function ReceiveStockForm({
  products,
  suppliers,
  busy,
  onSubmit,
}: {
  products: ProductWithStock[];
  suppliers: Supplier[];
  busy: boolean;
  onSubmit: (supplierId: Uuid | null, items: ReceiveItem[]) => void;
}) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  /** เลือกสินค้าแล้วเติมต้นทุนล่าสุดให้เป็นค่าตั้งต้น แก้ได้ */
  function pickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      product_id: productId,
      unit_cost: product?.cost_price != null ? String(parseMoney(product.cost_price)) : "",
    });
  }

  function submit() {
    const items: ReceiveItem[] = [];

    for (const line of lines) {
      if (!line.product_id) continue;
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unit_cost);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        setError("จำนวนที่รับเข้าต้องเป็นจำนวนเต็มมากกว่าศูนย์");
        return;
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        setError("ต้นทุนต่อหน่วยต้องไม่ติดลบ");
        return;
      }

      items.push({ product_id: line.product_id, quantity, unit_cost: unitCost });
    }

    if (items.length === 0) {
      setError("เลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    setError(null);
    onSubmit(supplierId === "" ? null : supplierId, items);
  }

  function reset() {
    setLines([{ ...emptyLine }]);
    setSupplierId("");
    setError(null);
  }

  return (
    <div className="panel p-4 space-y-4">
      <h2 className="font-display text-xl text-royal">รับสินค้าเข้า</h2>

      <label className="block max-w-sm">
        <span className="block mb-1 font-medium">ซัพพลายเออร์</span>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full min-h-touch"
        >
          <option value="">ไม่ระบุ</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        {lines.map((line, index) => {
          const product = products.find((p) => p.id === line.product_id);
          return (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_120px_140px_44px] items-end border-t border-royal/15 pt-2"
            >
              <label className="block">
                <span className="block mb-1 text-sm">สินค้า</span>
                <select
                  value={line.product_id}
                  onChange={(e) => pickProduct(index, e.target.value)}
                  className="w-full min-h-touch"
                >
                  <option value="">เลือกสินค้า</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block mb-1 text-sm">จำนวน</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  className="w-full min-h-touch num"
                />
              </label>

              <label className="block">
                <span className="block mb-1 text-sm">ต้นทุน/หน่วย</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={line.unit_cost}
                  onChange={(e) => updateLine(index, { unit_cost: e.target.value })}
                  className="w-full min-h-touch num"
                />
              </label>

              <button
                type="button"
                aria-label="ลบรายการนี้"
                onClick={() => setLines((c) => (c.length === 1 ? [{ ...emptyLine }] : c.filter((_, i) => i !== index)))}
                className="min-h-touch min-w-touch flex items-center justify-center text-danger"
              >
                <Trash2 size={18} strokeWidth={1.5} />
              </button>

              {product && (
                <p className="sm:col-span-4 text-xs text-ink/60">
                  คงเหลือปัจจุบัน {product.quantity} {product.unit} · ต้นทุนถัวเฉลี่ยตอนนี้{" "}
                  {formatMoney(product.cost_price ?? 0)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="ghost" onClick={() => setLines((c) => [...c, { ...emptyLine }])}>
        <span className="inline-flex items-center gap-1">
          <Plus size={18} strokeWidth={1.5} /> เพิ่มรายการ
        </span>
      </Button>

      {error && <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกรับเข้า"}
        </Button>
        <Button variant="secondary" onClick={reset} disabled={busy}>
          ล้างฟอร์ม
        </Button>
      </div>

      <p className="text-xs text-ink/60">
        ต้นทุนถัวเฉลี่ยถ่วงน้ำหนักจะถูกคำนวณใหม่ที่เซิร์ฟเวอร์ และบันทึกรายการเคลื่อนไหวคู่กับสต็อกในธุรกรรมเดียว
      </p>
    </div>
  );
}
