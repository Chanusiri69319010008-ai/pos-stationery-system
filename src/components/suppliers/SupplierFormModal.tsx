// =====================================================================
// SupplierFormModal — เพิ่ม/แก้ไขซัพพลายเออร์ (§5 หน้า 10)
// =====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import type { SupplierWithUsage } from "../../api/suppliers.api";

export type SupplierFormValues = {
  name: string;
  contact: string;
  email: string;
  note: string;
};

const emptyForm: SupplierFormValues = { name: "", contact: "", email: "", note: "" };

export function SupplierFormModal({
  open,
  editing,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: SupplierWithUsage | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => void;
}) {
  const [values, setValues] = useState<SupplierFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(
      editing
        ? {
            name: editing.name,
            contact: editing.contact ?? "",
            email: editing.email ?? "",
            note: editing.note ?? "",
          }
        : emptyForm,
    );
  }, [open, editing]);

  function update(field: keyof SupplierFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!values.name.trim()) {
      setError("ต้องกรอกชื่อซัพพลายเออร์");
      return;
    }
    if (values.email.trim() !== "" && !values.email.includes("@")) {
      setError("อีเมลไม่ถูกต้อง หรือเว้นว่างไว้ก็ได้");
      return;
    }

    setError(null);
    onSubmit(values);
  }

  return (
    <Modal
      open={open}
      title={editing ? "แก้ไขซัพพลายเออร์" : "เพิ่มซัพพลายเออร์"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="primary" form="supplier-form" type="submit" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-3">
        <TextField
          label="ชื่อซัพพลายเออร์"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="เบอร์ติดต่อ"
            value={values.contact}
            onChange={(e) => update("contact", e.target.value)}
            hint="เว้นว่างได้"
            inputMode="tel"
          />
          <TextField
            label="อีเมล"
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            hint="เว้นว่างได้"
          />
        </div>

        <label className="block">
          <span className="block mb-1 font-medium">บันทึกช่วยจำ</span>
          <textarea
            value={values.note}
            onChange={(e) => update("note", e.target.value)}
            rows={3}
            placeholder="เช่น ส่งของทุกวันอังคาร ขั้นต่ำ 1,000 บาท"
            className="w-full"
          />
        </label>

        {editing && editing.product_count > 0 && (
          <p className="text-sm bg-powder/50 border border-royal/20 rounded p-3">
            มีสินค้าผูกกับซัพพลายเออร์รายนี้อยู่ {editing.product_count} รายการ
          </p>
        )}

        {error && <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
