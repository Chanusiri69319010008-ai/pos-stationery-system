// =====================================================================
// หน้า 12 — จัดการพนักงาน (owner เท่านั้น) (§5)
// staff.id ต้องเท่ากับ auth.users.id เสมอ การเพิ่มพนักงานจึงต้องมีบัญชีล็อกอินก่อน
// ไม่มีปุ่มลบ เพราะบิลและ stock_movements อ้างถึง staff_id (§4)
// =====================================================================
import { useEffect, useState } from "react";
import {
  createStaffAccount,
  linkStaff,
  setStaffActive,
  updateStaffProfile,
} from "../api/staff.api";
import { useStaff } from "../hooks/useStaff";
import { useAuth } from "../hooks/useAuth";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { StaffTable } from "../components/staff/StaffTable";
import {
  StaffFormModal,
  type StaffFormMode,
  type StaffFormValues,
} from "../components/staff/StaffFormModal";
import type { Staff } from "../types/db";

export function StaffPage() {
  const { showToast } = useToast();
  const { staff: currentUser } = useAuth();
  const { staff, unlinked, loading, error, refresh } = useStaff();

  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<StaffFormMode>("create");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [toggling, setToggling] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "จัดการพนักงาน — Aunchan";
  }, []);

  function openForm(next: StaffFormMode, person: Staff | null = null) {
    setMode(next);
    setEditing(person);
    setFormOpen(true);
  }

  async function handleSubmit(values: StaffFormValues) {
    setBusy(true);
    try {
      if (mode === "edit" && editing) {
        await updateStaffProfile(editing.id, { name: values.name.trim(), role: values.role });
        showToast(`บันทึกข้อมูลของ ${values.name.trim()} แล้ว`, "success");
      } else if (mode === "link") {
        await linkStaff(values.userId, values.email, {
          name: values.name.trim(),
          role: values.role,
        });
        showToast(`ผูกบัญชี ${values.email} เข้ากับ ${values.name.trim()} แล้ว`, "success");
      } else {
        await createStaffAccount({
          email: values.email,
          password: values.password,
          name: values.name.trim(),
          role: values.role,
        });
        showToast(
          `สร้างบัญชีให้ ${values.name.trim()} แล้ว ให้พนักงานล็อกอินด้วย ${values.email.trim()}`,
          "success",
        );
      }

      setFormOpen(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      showToast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!toggling) return;
    setBusy(true);
    try {
      await setStaffActive(toggling.id, !toggling.is_active);
      showToast(
        `${toggling.is_active ? "ปิด" : "เปิด"}บัญชีของ ${toggling.name} แล้ว`,
        "success",
      );
      setToggling(null);
      await refresh();
    } catch (e) {
      showToast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-3">
      <PageHeader
        title="จัดการพนักงาน"
        description="เพิ่มบัญชีพนักงาน กำหนดสิทธิ์ และปิดบัญชีที่ไม่ได้ใช้แล้ว"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => openForm("create")}>
              เพิ่มพนักงาน
            </Button>
            <Button onClick={() => openForm("link")}>
              ผูกบัญชีที่มีอยู่
              {unlinked.length > 0 && <span className="num"> ({unlinked.length})</span>}
            </Button>
          </div>
        }
      />

      {unlinked.length > 0 && (
        <div className="panel p-3 mb-3 border-royal/30">
          <p className="text-sm">
            มีบัญชีล็อกอิน <span className="num">{unlinked.length}</span> บัญชีที่ยังไม่ได้ผูกกับพนักงานคนไหน
            — บัญชีเหล่านี้ล็อกอินเข้ามาแล้วจะใช้งานอะไรไม่ได้เลยจนกว่าจะผูก
          </p>
        </div>
      )}

      {loading && <p className="text-royal">กำลังโหลด…</p>}

      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && staff.length === 0 && (
        <EmptyState title="ยังไม่มีพนักงานในระบบ" description="กดปุ่มเพิ่มพนักงานเพื่อสร้างบัญชีแรก" />
      )}

      {!loading && !error && staff.length > 0 && (
        <StaffTable
          staff={staff}
          currentStaffId={currentUser?.id ?? null}
          onEdit={(person) => openForm("edit", person)}
          onToggleActive={(person) => setToggling(person)}
        />
      )}

      <div className="panel p-4 mt-3">
        <h2 className="font-display text-xl text-royal mb-2">วิธีเพิ่มพนักงาน</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-ink/80">
          <li>
            ปกติกด "เพิ่มพนักงาน" ได้เลย ระบบจะสมัครบัญชีให้พร้อมสร้างข้อมูลพนักงานในขั้นตอนเดียว
            โดยที่คุณไม่หลุดออกจากระบบ
          </li>
          <li>
            ถ้าโปรเจกต์ปิดการสมัครด้วยตัวเองไว้ ให้สร้างผู้ใช้ที่ Supabase Dashboard →
            Authentication → Users → Add user แล้วกลับมากด "ผูกบัญชีที่มีอยู่"
          </li>
          <li>
            การเปลี่ยนอีเมลและรีเซ็ตรหัสผ่านทำที่ Supabase Dashboard เท่านั้น
            หน้านี้จัดการได้เฉพาะชื่อ สิทธิ์ และสถานะการใช้งาน
          </li>
        </ol>
      </div>

      <StaffFormModal
        open={formOpen}
        mode={mode}
        editing={editing}
        unlinked={unlinked}
        busy={busy}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "ยืนยันปิดบัญชีพนักงาน" : "ยืนยันเปิดบัญชีพนักงาน"}
        busy={busy}
        confirmLabel={toggling?.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}
        onCancel={() => setToggling(null)}
        onConfirm={() => void handleToggleActive()}
        message={
          <p>
            {toggling?.is_active
              ? `${toggling?.name} จะล็อกอินเข้ามาแล้วใช้งานอะไรไม่ได้ทันที แต่บิลและประวัติที่เคยทำไว้ยังอยู่ครบ`
              : `${toggling?.name} จะกลับมาใช้งานได้ตามสิทธิ์เดิม`}
          </p>
        }
      />
    </div>
  );
}
