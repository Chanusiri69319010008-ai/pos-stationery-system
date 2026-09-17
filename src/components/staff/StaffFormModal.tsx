// =====================================================================
// StaffFormModal — เพิ่ม/ผูก/แก้ไขพนักงาน (§5 หน้า 12)
// 3 โหมดในกล่องเดียว เพราะทั้งสามกรอกข้อมูลชุดเดียวกันเกือบหมด
//   create = สมัครบัญชีใหม่ให้เลย
//   link   = ผูกบัญชีที่สร้างไว้แล้วใน Supabase Dashboard
//   edit   = แก้ชื่อหรือสิทธิ์ของคนเดิม (อีเมลแก้ที่นี่ไม่ได้ เพราะอยู่ที่ auth.users)
// =====================================================================
import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { formatDateTime } from "../../lib/datetime";
import type { UnlinkedAuthUser } from "../../api/staff.api";
import type { Staff, StaffRole } from "../../types/db";

export type StaffFormMode = "create" | "link" | "edit";

export type StaffFormValues = {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: StaffRole;
};

const emptyForm: StaffFormValues = {
  userId: "",
  email: "",
  password: "",
  name: "",
  role: "staff",
};

const title: Record<StaffFormMode, string> = {
  create: "เพิ่มพนักงาน (สร้างบัญชีใหม่)",
  link: "ผูกบัญชีที่มีอยู่แล้ว",
  edit: "แก้ไขข้อมูลพนักงาน",
};

export function StaffFormModal({
  open,
  mode,
  editing,
  unlinked,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: StaffFormMode;
  editing: Staff | null;
  unlinked: UnlinkedAuthUser[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => void;
}) {
  const [values, setValues] = useState<StaffFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(
      mode === "edit" && editing
        ? { userId: editing.id, email: editing.email, password: "", name: editing.name, role: editing.role }
        : emptyForm,
    );
  }, [open, mode, editing]);

  function update<K extends keyof StaffFormValues>(field: K, value: StaffFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!values.name.trim()) {
      setError("ต้องกรอกชื่อพนักงาน");
      return;
    }

    if (mode === "create") {
      if (!values.email.includes("@")) {
        setError("อีเมลไม่ถูกต้อง");
        return;
      }
      if (values.password.length < 8) {
        setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
        return;
      }
    }

    if (mode === "link" && !values.userId) {
      setError("เลือกบัญชีที่จะผูก");
      return;
    }

    setError(null);
    onSubmit(values);
  }

  return (
    <Modal
      open={open}
      title={title[mode]}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="primary" form="staff-form" type="submit" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit} className="space-y-3">
        {mode === "link" && (
          <label className="block">
            <span className="block mb-1 font-medium">บัญชีล็อกอินที่ยังไม่ได้ผูก</span>
            <select
              value={values.userId}
              onChange={(e) => {
                const picked = unlinked.find((u) => u.user_id === e.target.value);
                setValues((current) => ({
                  ...current,
                  userId: e.target.value,
                  email: picked ? picked.email : "",
                }));
              }}
              className="w-full min-h-touch"
              required
            >
              <option value="">— เลือกบัญชี —</option>
              {unlinked.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.email} (สร้างเมื่อ {formatDateTime(user.created_at)})
                </option>
              ))}
            </select>
            {unlinked.length === 0 && (
              <span className="block mt-1 text-xs text-ink/60">
                ไม่มีบัญชีที่รอผูก — สร้างผู้ใช้ใน Supabase Dashboard ที่เมนู Authentication → Users ก่อน
              </span>
            )}
          </label>
        )}

        {mode === "create" && (
          <>
            <TextField
              label="อีเมลสำหรับล็อกอิน"
              type="email"
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              hint="พนักงานจะใช้อีเมลนี้เข้าสู่ระบบ"
              required
            />
            <TextField
              label="รหัสผ่านตั้งต้น"
              type="text"
              value={values.password}
              onChange={(e) => update("password", e.target.value)}
              hint="อย่างน้อย 8 ตัวอักษร บอกพนักงานแล้วให้เปลี่ยนเองภายหลัง"
              required
            />
          </>
        )}

        {mode === "edit" && (
          <TextField label="อีเมล" value={values.email} readOnly disabled hint="แก้ที่ Supabase Dashboard เท่านั้น" />
        )}

        <TextField
          label="ชื่อที่แสดงในระบบ"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          hint="ชื่อนี้จะขึ้นบนใบเสร็จและในประวัติการขาย"
          required
        />

        <fieldset>
          <legend className="block mb-1 font-medium">สิทธิ์การใช้งาน</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={[
                "flex items-start gap-2 p-3 rounded border cursor-pointer min-h-touch",
                values.role === "staff" ? "border-royal bg-powder/40" : "border-royal/25",
              ].join(" ")}
            >
              <input
                type="radio"
                name="role"
                className="mt-1"
                checked={values.role === "staff"}
                onChange={() => update("role", "staff")}
              />
              <span>
                <span className="block font-medium">พนักงานขาย</span>
                <span className="block text-xs text-ink/60">
                  ขายสินค้า เปิด-ปิดรอบขายของตัวเอง ดูสต็อก — ไม่เห็นต้นทุนและกำไร
                </span>
              </span>
            </label>

            <label
              className={[
                "flex items-start gap-2 p-3 rounded border cursor-pointer min-h-touch",
                values.role === "owner" ? "border-royal bg-powder/40" : "border-royal/25",
              ].join(" ")}
            >
              <input
                type="radio"
                name="role"
                className="mt-1"
                checked={values.role === "owner"}
                onChange={() => update("role", "owner")}
              />
              <span>
                <span className="block font-medium">เจ้าของร้าน</span>
                <span className="block text-xs text-ink/60">
                  ทำได้ทุกอย่าง รวมถึงต้นทุน กำไร คืนสินค้า และจัดการพนักงาน
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {error && <p className="text-danger border border-danger/40 rounded px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
