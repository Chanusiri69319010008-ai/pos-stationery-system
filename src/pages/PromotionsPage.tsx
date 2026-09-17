// =====================================================================
// หน้า 8 — จัดการโปรโมชั่น (owner เท่านั้น) (§5)
// หน้านี้บันทึกได้แค่ "เงื่อนไข" ของโปรโมชั่น การคิดส่วนลดจริงเกิดที่
// checkout_sale ตอนปิดบิลเท่านั้น (§7.2 ขั้นที่ 9 และ 11)
// ไม่มีปุ่มลบ เพราะบิลเก่าอ้างถึง promotion_id ไว้ (§4 ห้ามลบข้อมูลที่มีประวัติ)
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import {
  createPromotion,
  setPromotionActive,
  updatePromotion,
  type PromotionInput,
  type PromotionWithProduct,
} from "../api/promotions.api";
import { usePromotions } from "../hooks/usePromotions";
import { useProducts } from "../hooks/useProducts";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { PromotionTable } from "../components/promotions/PromotionTable";
import {
  PromotionFormModal,
  type PromotionFormValues,
} from "../components/promotions/PromotionFormModal";

export function PromotionsPage() {
  const { showToast } = useToast();
  const { promotions, runningCount, loading, error, refresh } = usePromotions();
  const { products } = useProducts({ activeOnly: true });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionWithProduct | null>(null);
  const [toggling, setToggling] = useState<PromotionWithProduct | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "จัดการโปรโมชั่น — Aunchan";
  }, []);

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return promotions;
    return promotions.filter(
      (promo) =>
        promo.name.toLowerCase().includes(keyword) ||
        (promo.product_name ?? "").toLowerCase().includes(keyword) ||
        (promo.product_sku ?? "").toLowerCase().includes(keyword),
    );
  }, [promotions, search]);

  async function handleSubmit(values: PromotionFormValues) {
    setBusy(true);
    try {
      // คู่ scope ↔ discount_type ตายตัวตาม §4 และ constraint ในฐานข้อมูล
      const isItem = values.scope === "item";
      const payload: PromotionInput = {
        name: values.name.trim(),
        scope: values.scope,
        product_id: isItem ? values.product_id : null,
        min_amount: isItem ? null : Number(values.min_amount),
        discount_type: isItem ? "percentage" : "fixed_amount",
        discount_value: Number(values.discount_value),
        start_date: values.start_date,
        end_date: values.end_date,
        is_active: editing ? editing.is_active : true,
      };

      if (editing) {
        await updatePromotion(editing.id, payload);
        showToast(`บันทึกการแก้ไข ${payload.name} แล้ว`, "success");
      } else {
        await createPromotion(payload);
        showToast(`เพิ่มโปรโมชั่น ${payload.name} แล้ว`, "success");
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
      await setPromotionActive(toggling.id, !toggling.is_active);
      showToast(`${toggling.is_active ? "ปิด" : "เปิด"}โปรโมชั่น ${toggling.name} แล้ว`, "success");
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
        title="จัดการโปรโมชั่น"
        description={`กำลังใช้งานอยู่ ${runningCount} รายการ — ส่วนลดจะถูกคิดให้อัตโนมัติตอนปิดบิล`}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            เพิ่มโปรโมชั่น
          </Button>
        }
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อโปรโมชั่น ชื่อสินค้า หรือรหัสสินค้า"
        aria-label="ค้นหาโปรโมชั่น"
        className="w-full min-h-touch mb-3"
      />

      {loading && <p className="text-royal">กำลังโหลดโปรโมชั่น…</p>}

      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && promotions.length === 0 && (
        <EmptyState
          title="ยังไม่มีโปรโมชั่นในระบบ"
          description="เพิ่มโปรลด % รายสินค้า หรือโปรซื้อครบลดท้ายบิล แล้วระบบจะคิดให้เองตอนขาย"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              เพิ่มโปรโมชั่น
            </Button>
          }
        />
      )}

      {!loading && !error && promotions.length > 0 && visible.length === 0 && (
        <EmptyState
          title="ไม่พบโปรโมชั่นที่ค้นหา"
          description="ลองพิมพ์คำอื่น หรือล้างช่องค้นหาเพื่อดูทั้งหมด"
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <PromotionTable
          promotions={visible}
          onEdit={(promo) => {
            setEditing(promo);
            setFormOpen(true);
          }}
          onToggleActive={(promo) => setToggling(promo)}
        />
      )}

      <PromotionFormModal
        open={formOpen}
        editing={editing}
        products={products}
        busy={busy}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "ยืนยันปิดโปรโมชั่น" : "ยืนยันเปิดโปรโมชั่น"}
        busy={busy}
        confirmLabel={toggling?.is_active ? "ปิดโปรโมชั่น" : "เปิดโปรโมชั่น"}
        onCancel={() => setToggling(null)}
        onConfirm={() => void handleToggleActive()}
        message={
          <p>
            {toggling?.is_active
              ? `บิลที่ปิดหลังจากนี้จะไม่ได้ส่วนลดจาก ${toggling?.name} อีก ส่วนบิลเก่ายังคงส่วนลดเดิมไว้ครบ`
              : `${toggling?.name} จะกลับมาใช้ได้ทันทีถ้าวันนี้อยู่ในช่วงวันที่ที่กำหนดไว้`}
          </p>
        }
      />
    </div>
  );
}
