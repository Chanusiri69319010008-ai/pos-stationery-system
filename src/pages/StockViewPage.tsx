// =====================================================================
// หน้า 4 — ดูสต็อก (อ่านอย่างเดียว) (§5)
// การแก้ยอดสต็อกเป็นสิทธิ์ owner และทำผ่าน RPC ในกลุ่มงาน P1
// =====================================================================
import { useEffect, useMemo, useState } from "react";
import { useProducts } from "../hooks/useProducts";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { LowStockBanner } from "../components/stock/LowStockBanner";
import { StockTable } from "../components/stock/StockTable";

export function StockViewPage() {
  const { products, lowStock, loading, error } = useProducts();
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "ดูสต็อก — Aunchan";
  }, []);

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword) ||
        product.sku.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword),
    );
  }, [products, search]);

  return (
    <div className="max-w-6xl mx-auto p-3">
      <PageHeader title="ดูสต็อก" description="ยอดคงเหลือปัจจุบันของสินค้าทุกรายการ" />

      <LowStockBanner items={lowStock} />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อสินค้า รหัสสินค้า หรือหมวด"
        aria-label="ค้นหาสินค้า"
        className="w-full min-h-touch mb-3"
      />

      {loading && <p className="text-royal">กำลังโหลดสต็อก…</p>}

      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="ยังไม่มีสินค้าในระบบ"
          description="ให้เจ้าของร้านเพิ่มสินค้าที่หน้าจัดการสินค้าก่อน"
        />
      )}

      {!loading && !error && products.length > 0 && visible.length === 0 && (
        <EmptyState
          title="ไม่พบสินค้าที่ค้นหา"
          description="ลองพิมพ์คำอื่น หรือล้างช่องค้นหาเพื่อดูสินค้าทั้งหมด"
        />
      )}

      {!loading && !error && visible.length > 0 && <StockTable products={visible} />}
    </div>
  );
}
