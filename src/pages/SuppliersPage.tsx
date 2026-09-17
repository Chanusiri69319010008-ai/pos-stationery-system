// =====================================================================
// หน้า 10 — จัดการซัพพลายเออร์ (owner เท่านั้น) (§5)
// ไม่มีปุ่มลบ เพราะ products.supplier_id และ stock_movements.ref_id อ้างถึงอยู่
// ปิดการใช้งานแทน — ประวัติการรับสินค้าเข้ายังอยู่ครบ (§4)
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import {
  createSupplier,
  setSupplierActive,
  updateSupplier,
  type SupplierWithUsage,
} from "../api/suppliers.api";
import { useSuppliers } from "../hooks/useSuppliers";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { SupplierTable } from "../components/suppliers/SupplierTable";
import {
  SupplierFormModal,
  type SupplierFormValues,
} from "../components/suppliers/SupplierFormModal";

export function SuppliersPage() {
  const { showToast } = useToast();
  const { suppliers, loading, error, refresh } = useSuppliers();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierWithUsage | null>(null);
  const [toggling, setToggling] = useState<SupplierWithUsage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "จัดการซัพพลายเออร์ — Aunchan";
  }, []);

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return suppliers;
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(keyword) ||
        (supplier.contact ?? "").toLowerCase().includes(keyword) ||
        (supplier.email ?? "").toLowerCase().includes(keyword) ||
        (supplier.note ?? "").toLowerCase().includes(keyword),
    );
  }, [suppliers, search]);

  async function handleSubmit(values: SupplierFormValues) {
    setBusy(true);
    try {
      const payload = {
        name: values.name.trim(),
        contact: values.contact.trim() === "" ? null : values.contact.trim(),
        email: values.email.trim() === "" ? null : values.email.trim(),
        note: values.note.trim() === "" ? null : values.note.trim(),
      };

      if (editing) {
        await updateSupplier(editing.id, payload);
        showToast(`บันทึกการแก้ไข ${payload.name} แล้ว`, "success");
      } else {
        await createSupplier(payload);
        showToast(`เพิ่มซัพพลายเออร์ ${payload.name} แล้ว`, "success");
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
      await setSupplierActive(toggling.id, !toggling.is_active);
      showToast(
        `${toggling.is_active ? "ปิด" : "เปิด"}การใช้งาน ${toggling.name} แล้ว`,
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
        title="จัดการซัพพลายเออร์"
        description="รายชื่อร้านที่เรารับสินค้าเข้ามาขาย ใช้เลือกตอนรับสินค้าเข้าสต็อก"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            เพิ่มซัพพลายเออร์
          </Button>
        }
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อ เบอร์ติดต่อ อีเมล หรือบันทึกช่วยจำ"
        aria-label="ค้นหาซัพพลายเออร์"
        className="w-full min-h-touch mb-3"
      />

      {loading && <p className="text-royal">กำลังโหลด…</p>}

      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && suppliers.length === 0 && (
        <EmptyState
          title="ยังไม่มีซัพพลายเออร์ในระบบ"
          description="เพิ่มร้านที่เราสั่งของประจำ แล้วจะเลือกได้ตอนรับสินค้าเข้าสต็อก"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              เพิ่มซัพพลายเออร์
            </Button>
          }
        />
      )}

      {!loading && !error && suppliers.length > 0 && visible.length === 0 && (
        <EmptyState
          title="ไม่พบซัพพลายเออร์ที่ค้นหา"
          description="ลองพิมพ์คำอื่น หรือล้างช่องค้นหาเพื่อดูทั้งหมด"
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <SupplierTable
          suppliers={visible}
          onEdit={(supplier) => {
            setEditing(supplier);
            setFormOpen(true);
          }}
          onToggleActive={(supplier) => setToggling(supplier)}
        />
      )}

      <SupplierFormModal
        open={formOpen}
        editing={editing}
        busy={busy}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "ยืนยันปิดการใช้งาน" : "ยืนยันเปิดการใช้งาน"}
        busy={busy}
        confirmLabel={toggling?.is_active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
        onCancel={() => setToggling(null)}
        onConfirm={() => void handleToggleActive()}
        message={
          <p>
            {toggling?.is_active
              ? `${toggling?.name} จะไม่ขึ้นให้เลือกตอนรับสินค้าเข้าอีก แต่ประวัติการรับของเดิมและสินค้า ${toggling?.product_count ?? 0} รายการที่ผูกไว้ยังอยู่ครบ`
              : `${toggling?.name} จะกลับมาเลือกได้ตามปกติ`}
          </p>
        }
      />
    </div>
  );
}
