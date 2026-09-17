// =====================================================================
// ProductFormModal — เพิ่ม/แก้ไขสินค้า (§5 หน้า 6)
// ต้นทุนแสดงอย่างเดียว แก้ไม่ได้ เพราะคำนวณถัวเฉลี่ยถ่วงน้ำหนักตอนรับสินค้าเข้า (§4)
// ยอดคงเหลือแก้ที่นี่ไม่ได้ ต้องผ่าน RPC รับสินค้าเข้า/ปรับยอดเท่านั้น (§7.1)
// =====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { formatMoney } from "../../lib/money";
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from "../../api/storage.api";
import type { ProductWithStock } from "../../types/db";

export type ProductFormValues = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: string;
  barcode: string;
  reorder_point: string;
  supplier_id: string;
  /** URL รูปเดิมที่ใช้อยู่ — ว่าง = ไม่มีรูปหรือสั่งลบรูปเดิม */
  image_url: string;
  /** ไฟล์ที่เพิ่งเลือก ยังไม่ถูกอัปโหลด หน้าเรียกเป็นคนอัปโหลดตอนบันทึก */
  imageFile: File | null;
};

const emptyForm: ProductFormValues = {
  name: "",
  sku: "",
  category: "",
  unit: "",
  price: "",
  barcode: "",
  reorder_point: "5",
  supplier_id: "",
  image_url: "",
  imageFile: null,
};

export function ProductFormModal({
  open,
  editing,
  categories,
  suppliers,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ProductWithStock | null;
  categories: string[];
  suppliers: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => void;
}) {
  const [values, setValues] = useState<ProductFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // สร้าง URL ชั่วคราวของไฟล์ที่เลือกครั้งเดียว แล้วคืนหน่วยความจำเมื่อเปลี่ยนไฟล์
  useEffect(() => {
    if (!values.imageFile) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(values.imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [values.imageFile]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(
      editing
        ? {
            name: editing.name,
            sku: editing.sku,
            category: editing.category,
            unit: editing.unit,
            price: String(editing.price),
            barcode: editing.barcode ?? "",
            reorder_point: String(editing.reorder_point),
            supplier_id: editing.supplier_id ?? "",
            image_url: editing.image_url ?? "",
            imageFile: null,
          }
        : emptyForm,
    );
  }, [open, editing]);

  function update(field: keyof ProductFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function pickImage(file: File | null) {
    if (!file) {
      setValues((current) => ({ ...current, imageFile: null }));
      return;
    }

    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      setError("รับเฉพาะไฟล์ JPG, PNG หรือ WebP");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("ไฟล์ใหญ่เกิน 2 MB ลองย่อรูปก่อนอัปโหลด");
      return;
    }

    setError(null);
    setValues((current) => ({ ...current, imageFile: file }));
  }

  function removeImage() {
    setValues((current) => ({ ...current, imageFile: null, image_url: "" }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!values.name.trim() || !values.sku.trim() || !values.category.trim() || !values.unit.trim()) {
      setError("กรอกชื่อสินค้า รหัสสินค้า หมวด และหน่วยให้ครบ");
      return;
    }
    if (Number(values.price) <= 0) {
      setError("ราคาขายต้องมากกว่าศูนย์");
      return;
    }
    if (Number(values.reorder_point) < 0) {
      setError("จุดสั่งซื้อต้องไม่ติดลบ");
      return;
    }

    setError(null);
    onSubmit(values);
  }

  return (
    <Modal
      open={open}
      title={editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="primary" form="product-form" type="submit" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-3">
        <TextField
          label="ชื่อสินค้า"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="รหัสสินค้า (SKU)"
            value={values.sku}
            onChange={(e) => update("sku", e.target.value)}
            hint="เช่น P021"
            required
          />
          <TextField
            label="บาร์โค้ด"
            value={values.barcode}
            onChange={(e) => update("barcode", e.target.value)}
            hint="เว้นว่างได้"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block mb-1 font-medium">หมวด</span>
            <input
              list="product-categories"
              value={values.category}
              onChange={(e) => update("category", e.target.value)}
              className="w-full min-h-touch"
              required
            />
            <datalist id="product-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>

          <TextField
            label="หน่วย"
            value={values.unit}
            onChange={(e) => update("unit", e.target.value)}
            hint="เช่น ชิ้น / แพ็ค / กล่อง"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="ราคาขาย (ยังไม่รวม VAT)"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            required
          />
          <TextField
            label="จุดสั่งซื้อ"
            type="number"
            min={0}
            value={values.reorder_point}
            onChange={(e) => update("reorder_point", e.target.value)}
            hint="แจ้งเตือนเมื่อคงเหลือ ≤ ค่านี้"
            required
          />
        </div>

        <div className="block">
          <span className="block mb-1 font-medium">รูปสินค้า</span>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-24 h-24 border border-royal/25 rounded bg-powder/40 flex items-center justify-center overflow-hidden">
              {preview ? (
                <img src={preview} alt="รูปที่เพิ่งเลือก" className="w-full h-full object-cover" />
              ) : values.image_url ? (
                <img src={values.image_url} alt="รูปสินค้าปัจจุบัน" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-ink/50">ไม่มีรูป</span>
              )}
            </div>

            <div className="flex-1">
              <input
                type="file"
                accept={IMAGE_MIME_TYPES.join(",")}
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                aria-label="เลือกรูปสินค้า"
                className="w-full text-sm"
              />
              <p className="text-xs text-ink/60 mt-1">
                JPG, PNG หรือ WebP ไม่เกิน 2 MB · รูปจะถูกอัปโหลดตอนกดบันทึก
              </p>
              {(values.image_url || values.imageFile) && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="mt-2 text-sm text-danger underline min-h-touch"
                >
                  เอารูปออก
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="block mb-1 font-medium">ซัพพลายเออร์</span>
          <select
            value={values.supplier_id}
            onChange={(e) => update("supplier_id", e.target.value)}
            className="w-full min-h-touch"
          >
            <option value="">— ไม่ระบุ —</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <span className="block mt-1 text-xs text-ink/60">
            ร้านที่สั่งของประจำ ใช้เป็นค่าตั้งต้นตอนรับสินค้าเข้า เว้นว่างได้
          </span>
        </label>

        {editing && (
          <div className="bg-powder/50 border border-royal/20 rounded p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>ต้นทุนถัวเฉลี่ยปัจจุบัน</span>
              <span className="num">{formatMoney(editing.cost_price ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>ยอดคงเหลือ</span>
              <span className="num">
                {editing.quantity} {editing.unit}
              </span>
            </div>
            <p className="text-xs text-ink/60">
              ต้นทุนและยอดคงเหลือแก้ที่นี่ไม่ได้ ต้องทำผ่านรับสินค้าเข้า/ปรับยอด
            </p>
          </div>
        )}

        {error && <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
