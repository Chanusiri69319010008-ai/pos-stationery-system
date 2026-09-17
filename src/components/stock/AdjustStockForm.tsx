// =====================================================================
// AdjustStockForm — ปรับยอดสต็อก และบันทึกของเสีย (§5 หน้า 7, §7.8)
// ทั้งสองอย่างต้องระบุเหตุผลเสมอ (§4 ห้ามทำ ข้อ 3 — ฐานข้อมูลบังคับด้วย trigger อีกชั้น)
// ผลต่างคำนวณที่ RPC ไม่ใช่ที่นี่
// =====================================================================
import { useState } from "react";
import { Button } from "../ui/Button";
import type { ProductWithStock, Uuid } from "../../types/db";

export type StockChangeMode = "adjust" | "waste";

export function AdjustStockForm({
  products,
  busy,
  onSubmit,
}: {
  products: ProductWithStock[];
  busy: boolean;
  onSubmit: (mode: StockChangeMode, productId: Uuid, value: number, reason: string) => void;
}) {
  const [mode, setMode] = useState<StockChangeMode>("adjust");
  const [productId, setProductId] = useState<string>("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId);

  function submit() {
    if (!productId) {
      setError("เลือกสินค้าก่อน");
      return;
    }

    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 0) {
      setError("จำนวนต้องเป็นจำนวนเต็มและไม่ติดลบ");
      return;
    }
    if (mode === "waste" && amount <= 0) {
      setError("จำนวนของเสียต้องมากกว่าศูนย์");
      return;
    }
    if (reason.trim() === "") {
      setError("ต้องระบุเหตุผล");
      return;
    }

    setError(null);
    onSubmit(mode, productId, amount, reason.trim());
  }

  return (
    <div className="panel p-4 space-y-4">
      <h2 className="font-display text-xl text-royal">ปรับยอด / บันทึกของเสีย</h2>

      <div className="grid grid-cols-2 gap-2 max-w-sm">
        {(["adjust", "waste"] as StockChangeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setValue("");
              setError(null);
            }}
            className={[
              "min-h-touch rounded border",
              mode === m
                ? "bg-royal text-paper border-royal font-medium"
                : "bg-paper text-royal border-royal/30",
            ].join(" ")}
          >
            {m === "adjust" ? "ปรับยอดให้ตรงของจริง" : "บันทึกของเสีย"}
          </button>
        ))}
      </div>

      <label className="block max-w-md">
        <span className="block mb-1 font-medium">สินค้า</span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full min-h-touch"
        >
          <option value="">เลือกสินค้า</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name} (คงเหลือ {p.quantity})
            </option>
          ))}
        </select>
      </label>

      <label className="block max-w-xs">
        <span className="block mb-1 font-medium">
          {mode === "adjust" ? "ยอดคงเหลือที่นับได้จริง" : "จำนวนที่เสียหาย"}
        </span>
        <input
          type="number"
          min={mode === "adjust" ? 0 : 1}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full min-h-touch num text-lg"
        />
        {product && (
          <span className="block mt-1 text-xs text-ink/60">
            ยอดในระบบตอนนี้ {product.quantity} {product.unit}
          </span>
        )}
      </label>

      <label className="block">
        <span className="block mb-1 font-medium">เหตุผล (บังคับ)</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === "adjust" ? "เช่น นับสต็อกประจำเดือน" : "เช่น สินค้าชำรุดจากการขนส่ง"}
          className="w-full min-h-touch"
          maxLength={255}
        />
      </label>

      {error && <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>}

      <Button variant="primary" onClick={submit} disabled={busy}>
        {busy ? "กำลังบันทึก…" : mode === "adjust" ? "บันทึกการปรับยอด" : "บันทึกของเสีย"}
      </Button>
    </div>
  );
}
