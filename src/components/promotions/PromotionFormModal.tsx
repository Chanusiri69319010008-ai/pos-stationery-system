// =====================================================================
// PromotionFormModal — เพิ่ม/แก้ไขโปรโมชั่น (§5 หน้า 8)
// รองรับ 2 รูปแบบตาม §4 เท่านั้น:
//   scope = 'item' → ลด % ต่อสินค้า   (discount_type = 'percentage')
//   scope = 'bill' → ซื้อครบ N ลด M บาท (discount_type = 'fixed_amount')
// การตรวจค่าที่นี่เป็นการเตือนผู้ใช้ล่วงหน้าเท่านั้น ตัวบังคับจริงคือ constraint
// ในฐานข้อมูล (promotions_scope_discount_type_chk / _discount_value_chk / _date_range_chk)
// =====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { todayInBangkok } from "../../lib/datetime";
import type { PromotionWithProduct } from "../../api/promotions.api";
import type { ProductWithStock, PromotionScope } from "../../types/db";

export type PromotionFormValues = {
  name: string;
  scope: PromotionScope;
  product_id: string;
  min_amount: string;
  discount_value: string;
  start_date: string;
  end_date: string;
};

function emptyForm(): PromotionFormValues {
  const today = todayInBangkok();
  return {
    name: "",
    scope: "item",
    product_id: "",
    min_amount: "",
    discount_value: "",
    start_date: today,
    end_date: today,
  };
}

export function PromotionFormModal({
  open,
  editing,
  products,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: PromotionWithProduct | null;
  products: ProductWithStock[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: PromotionFormValues) => void;
}) {
  const [values, setValues] = useState<PromotionFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(
      editing
        ? {
            name: editing.name,
            scope: editing.scope,
            product_id: editing.product_id ?? "",
            min_amount: editing.min_amount === null ? "" : String(editing.min_amount),
            discount_value: String(editing.discount_value),
            start_date: editing.start_date,
            end_date: editing.end_date,
          }
        : emptyForm(),
    );
  }, [open, editing]);

  function update<K extends keyof PromotionFormValues>(field: K, value: PromotionFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!values.name.trim()) {
      setError("ตั้งชื่อโปรโมชั่นก่อน เช่น ลด 10% ปากกาเจล");
      return;
    }

    if (values.scope === "item") {
      if (!values.product_id) {
        setError("โปรลด % รายสินค้า ต้องเลือกสินค้าที่จะลด");
        return;
      }
      const percent = Number(values.discount_value);
      if (!(percent > 0) || percent > 100) {
        setError("เปอร์เซ็นต์ส่วนลดต้องมากกว่า 0 และไม่เกิน 100");
        return;
      }
    } else {
      if (!(Number(values.min_amount) > 0)) {
        setError("โปรซื้อครบลด ต้องระบุยอดขั้นต่ำมากกว่า 0 บาท");
        return;
      }
      if (!(Number(values.discount_value) > 0)) {
        setError("จำนวนเงินที่ลดต้องมากกว่า 0 บาท");
        return;
      }
      if (Number(values.discount_value) > Number(values.min_amount)) {
        setError("จำนวนเงินที่ลดต้องไม่มากกว่ายอดขั้นต่ำ");
        return;
      }
    }

    if (values.end_date < values.start_date) {
      setError("วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม");
      return;
    }

    setError(null);
    onSubmit(values);
  }

  return (
    <Modal
      open={open}
      title={editing ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่นใหม่"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="primary" form="promotion-form" type="submit" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      }
    >
      <form id="promotion-form" onSubmit={handleSubmit} className="space-y-3">
        <TextField
          label="ชื่อโปรโมชั่น"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          hint="ชื่อนี้จะขึ้นในประวัติของบิลที่ใช้โปรนี้"
          required
        />

        <fieldset>
          <legend className="block mb-1 font-medium">รูปแบบโปรโมชั่น</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={[
                "flex items-start gap-2 p-3 rounded border cursor-pointer min-h-touch",
                values.scope === "item" ? "border-royal bg-powder/40" : "border-royal/25",
              ].join(" ")}
            >
              <input
                type="radio"
                name="scope"
                className="mt-1"
                checked={values.scope === "item"}
                onChange={() => update("scope", "item")}
              />
              <span>
                <span className="block font-medium">ลด % รายสินค้า</span>
                <span className="block text-xs text-ink/60">ลดเป็นเปอร์เซ็นต์จากราคาสินค้าที่เลือก</span>
              </span>
            </label>

            <label
              className={[
                "flex items-start gap-2 p-3 rounded border cursor-pointer min-h-touch",
                values.scope === "bill" ? "border-royal bg-powder/40" : "border-royal/25",
              ].join(" ")}
            >
              <input
                type="radio"
                name="scope"
                className="mt-1"
                checked={values.scope === "bill"}
                onChange={() => update("scope", "bill")}
              />
              <span>
                <span className="block font-medium">ซื้อครบลดเป็นบาท</span>
                <span className="block text-xs text-ink/60">ลดท้ายบิลเมื่อยอดถึงเกณฑ์ที่กำหนด</span>
              </span>
            </label>
          </div>
        </fieldset>

        {values.scope === "item" ? (
          <>
            <label className="block">
              <span className="block mb-1 font-medium">สินค้าที่ลด</span>
              <select
                value={values.product_id}
                onChange={(e) => update("product_id", e.target.value)}
                className="w-full min-h-touch"
                required
              >
                <option value="">— เลือกสินค้า —</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </select>
            </label>

            <TextField
              label="ส่วนลด (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={values.discount_value}
              onChange={(e) => update("discount_value", e.target.value)}
              hint="ลดจากราคาขายก่อน VAT"
              required
            />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="ซื้อครบ (บาท)"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={values.min_amount}
              onChange={(e) => update("min_amount", e.target.value)}
              hint="วัดจากยอดหลังลดรายสินค้า"
              required
            />
            <TextField
              label="ลด (บาท)"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={values.discount_value}
              onChange={(e) => update("discount_value", e.target.value)}
              required
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="วันเริ่ม"
            type="date"
            value={values.start_date}
            onChange={(e) => update("start_date", e.target.value)}
            required
          />
          <TextField
            label="วันสิ้นสุด"
            type="date"
            value={values.end_date}
            onChange={(e) => update("end_date", e.target.value)}
            hint="ใช้ได้ถึงสิ้นวันนี้"
            required
          />
        </div>

        <p className="text-xs text-ink/60 bg-powder/50 border border-royal/20 rounded p-3">
          ถ้ามีหลายโปรเข้าเกณฑ์พร้อมกัน ระบบจะเลือกโปรที่ลดมากที่สุดให้ลูกค้าโดยอัตโนมัติ
          และลดรายสินค้าก่อน แล้วจึงวัดยอดเพื่อลดท้ายบิล
        </p>

        {error && <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
