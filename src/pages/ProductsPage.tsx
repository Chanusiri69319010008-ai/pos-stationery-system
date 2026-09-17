// =====================================================================
// หน้า 6 — จัดการสินค้า (owner เท่านั้น) (§5)
// รูปสินค้า (Supabase Storage) เป็นงาน P2 ตาม §11 ข้อ 12 จึงยังไม่มีในหน้านี้
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import {
  createProduct,
  setProductActive,
  updateProduct,
  updateReorderPoint,
} from "../api/products.api";
import { deleteProductImage, uploadProductImage } from "../api/storage.api";
import { useProducts } from "../hooks/useProducts";
import { useSuppliers } from "../hooks/useSuppliers";
import { errorMessage } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { LowStockBanner } from "../components/stock/LowStockBanner";
import { ProductTable } from "../components/products/ProductTable";
import {
  ProductFormModal,
  type ProductFormValues,
} from "../components/products/ProductFormModal";
import type { ProductWithStock } from "../types/db";

export function ProductsPage() {
  const { showToast } = useToast();
  const { products, categories, lowStock, loading, error, refresh } = useProducts({
    withCost: true,
  });
  const { suppliers } = useSuppliers({ withUsage: false, activeOnly: true });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [toggling, setToggling] = useState<ProductWithStock | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "จัดการสินค้า — Aunchan";
  }, []);

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword) ||
        product.sku.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword) ||
        (product.barcode ?? "").toLowerCase().includes(keyword),
    );
  }, [products, search]);

  async function handleSubmit(values: ProductFormValues) {
    setBusy(true);
    try {
      // อัปโหลดรูปก่อน ถ้าอัปโหลดล้มจะไม่บันทึกสินค้าเลย จะได้ไม่มีสินค้าที่ชี้ไปรูปที่ไม่มีจริง
      const previousImage = editing?.image_url ?? null;
      let imageUrl: string | null = values.image_url === "" ? null : values.image_url;

      if (values.imageFile) {
        imageUrl = await uploadProductImage(values.imageFile, values.sku);
      }

      const payload = {
        name: values.name.trim(),
        sku: values.sku.trim(),
        category: values.category.trim(),
        unit: values.unit.trim(),
        price: Number(values.price),
        barcode: values.barcode.trim() === "" ? null : values.barcode.trim(),
        supplier_id: values.supplier_id === "" ? null : values.supplier_id,
        image_url: imageUrl,
        is_vat_exempt: false,
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        await updateReorderPoint(editing.id, Number(values.reorder_point));
        showToast(`บันทึกการแก้ไข ${payload.name} แล้ว`, "success");
      } else {
        await createProduct(payload, Number(values.reorder_point));
        showToast(`เพิ่มสินค้า ${payload.name} แล้ว (ยอดคงเหลือเริ่มต้น 0)`, "success");
      }

      // ลบรูปเก่าทิ้งหลังบันทึกสำเร็จแล้วเท่านั้น ลบไม่ได้ก็ไม่ถือว่าการบันทึกล้มเหลว
      if (previousImage && previousImage !== imageUrl) {
        try {
          await deleteProductImage(previousImage);
        } catch {
          showToast("บันทึกแล้ว แต่ลบไฟล์รูปเก่าไม่สำเร็จ", "error");
        }
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
      await setProductActive(toggling.id, !toggling.is_active);
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
        title="จัดการสินค้า"
        description="เพิ่ม แก้ไข และปิดการใช้งานสินค้า"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            เพิ่มสินค้า
          </Button>
        }
      />

      <LowStockBanner items={lowStock} />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อสินค้า รหัสสินค้า บาร์โค้ด หรือหมวด"
        aria-label="ค้นหาสินค้า"
        className="w-full min-h-touch mb-3"
      />

      {loading && <p className="text-royal">กำลังโหลดสินค้า…</p>}

      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="ยังไม่มีสินค้าในระบบ"
          description="กดปุ่มเพิ่มสินค้าเพื่อสร้างรายการแรก แล้วรับสินค้าเข้าสต็อกก่อนเริ่มขาย"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              เพิ่มสินค้า
            </Button>
          }
        />
      )}

      {!loading && !error && products.length > 0 && visible.length === 0 && (
        <EmptyState
          title="ไม่พบสินค้าที่ค้นหา"
          description="ลองพิมพ์คำอื่น หรือล้างช่องค้นหาเพื่อดูสินค้าทั้งหมด"
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <ProductTable
          products={visible}
          onEdit={(product) => {
            setEditing(product);
            setFormOpen(true);
          }}
          onToggleActive={(product) => setToggling(product)}
        />
      )}

      <ProductFormModal
        open={formOpen}
        editing={editing}
        categories={categories}
        suppliers={suppliers}
        busy={busy}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "ยืนยันปิดการใช้งานสินค้า" : "ยืนยันเปิดการใช้งานสินค้า"}
        busy={busy}
        confirmLabel={toggling?.is_active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
        onCancel={() => setToggling(null)}
        onConfirm={() => void handleToggleActive()}
        message={
          <p>
            {toggling?.is_active
              ? `${toggling?.name} จะไม่ปรากฏบนหน้าขายอีก แต่ประวัติการขายเดิมยังอยู่ครบ`
              : `${toggling?.name} จะกลับมาขายได้ตามปกติ`}
          </p>
        }
      />
    </div>
  );
}
