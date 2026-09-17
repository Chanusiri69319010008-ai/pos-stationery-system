// =====================================================================
// หน้า 11 — รายงาน (owner เท่านั้น) (§5)
// 3 รายงาน: ยอดขายรายวัน · ยอดขายรายสินค้า · มูลค่าสต็อกคงเหลือ
// ยอดทุกตัวรวมมาจากฐานข้อมูลแล้ว (view + RPC ใน 008 และ 011) หน้านี้ไม่บวกเลขเอง
//
// §5 หน้า 11: กำไรขั้นต้นดูได้บนจอ แต่ห้ามส่งออกไปกับไฟล์ CSV
// ไฟล์ที่ส่งออกจึงไม่มีคอลัมน์กำไรและไม่มีคอลัมน์ต้นทุนของรายงานยอดขาย
// =====================================================================
import { useEffect, useState } from "react";
import { useReports } from "../hooks/useReports";
import { csvMoney, formatMoney, formatQty } from "../lib/money";
import { formatDate } from "../lib/datetime";
import { downloadCsv, toCsv } from "../lib/csv";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toast";
import { ReportTable } from "../components/reports/ReportTable";
import type { DailySummary, ProductSalesRow, StockValueRow } from "../api/reports.api";

type Tab = "daily" | "products" | "stock";

const tabs: { id: Tab; label: string }[] = [
  { id: "daily", label: "ยอดขายรายวัน" },
  { id: "products", label: "ยอดขายรายสินค้า" },
  { id: "stock", label: "มูลค่าสต็อก" },
];

export function ReportsPage() {
  const { showToast } = useToast();
  const {
    from,
    to,
    setFrom,
    setTo,
    daily,
    products,
    stock,
    stockSummary,
    loading,
    error,
    refresh,
  } = useReports();

  const [tab, setTab] = useState<Tab>("daily");

  useEffect(() => {
    document.title = "รายงาน — Aunchan";
  }, []);

  function exportDaily() {
    // ไม่มีคอลัมน์ net_cost และ gross_profit ตาม §5 หน้า 11
    const csv = toCsv<DailySummary>(daily, [
      { header: "วันที่", value: (r) => r.sale_date },
      { header: "จำนวนบิล", value: (r) => r.bill_count },
      { header: "ยอดออกบิล", value: (r) => csvMoney(r.total_sales) },
      { header: "เงินคืนลูกค้า", value: (r) => csvMoney(r.refund_total) },
      { header: "ยอดขายสุทธิ", value: (r) => csvMoney(r.net_sales) },
      { header: "ยอดก่อนภาษี", value: (r) => csvMoney(r.subtotal_total) },
      { header: "VAT", value: (r) => csvMoney(r.vat_total) },
      { header: "ส่วนลดรวม", value: (r) => csvMoney(r.discount_total) },
    ]);

    downloadCsv(`aunchan-ยอดขายรายวัน-${from}-ถึง-${to}`, csv);
    showToast(`ส่งออกยอดขายรายวัน ${daily.length} วันแล้ว`, "success");
  }

  function exportProducts() {
    const csv = toCsv<ProductSalesRow>(products, [
      { header: "รหัสสินค้า", value: (r) => r.sku },
      { header: "ชื่อสินค้า", value: (r) => r.name },
      { header: "หมวด", value: (r) => r.category },
      { header: "จำนวนที่ขายได้", value: (r) => r.qty_sold },
      { header: "ยอดขายสุทธิ", value: (r) => csvMoney(r.net_revenue) },
    ]);

    downloadCsv(`aunchan-ยอดขายรายสินค้า-${from}-ถึง-${to}`, csv);
    showToast(`ส่งออกยอดขายรายสินค้า ${products.length} รายการแล้ว`, "success");
  }

  function exportStock() {
    const csv = toCsv<StockValueRow>(stock, [
      { header: "รหัสสินค้า", value: (r) => r.sku },
      { header: "ชื่อสินค้า", value: (r) => r.name },
      { header: "หมวด", value: (r) => r.category },
      { header: "หน่วย", value: (r) => r.unit },
      { header: "คงเหลือ", value: (r) => r.quantity },
      { header: "จุดสั่งซื้อ", value: (r) => r.reorder_point },
      { header: "ทุนต่อหน่วย", value: (r) => csvMoney(r.cost_price) },
      { header: "ราคาขาย", value: (r) => csvMoney(r.price) },
      { header: "มูลค่าสต็อก", value: (r) => csvMoney(r.stock_value) },
    ]);

    downloadCsv(`aunchan-มูลค่าสต็อก-${to}`, csv);
    showToast(`ส่งออกมูลค่าสต็อก ${stock.length} รายการแล้ว`, "success");
  }

  const empty =
    (tab === "daily" && daily.length === 0) ||
    (tab === "products" && products.length === 0) ||
    (tab === "stock" && stock.length === 0);

  return (
    <div className="max-w-6xl mx-auto p-3">
      <PageHeader
        title="รายงาน"
        description="สรุปยอดขายและมูลค่าสต็อก ส่งออกเป็นไฟล์ CSV เปิดด้วย Excel ได้"
        actions={<Button onClick={() => void refresh()}>โหลดใหม่</Button>}
      />

      <div className="panel p-3 mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
        <label className="block">
          <span className="block mb-1 text-sm">ตั้งแต่วันที่</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full min-h-touch num"
          />
        </label>
        <label className="block">
          <span className="block mb-1 text-sm">ถึงวันที่</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="w-full min-h-touch num"
          />
        </label>
        <p className="text-sm text-ink/70 pb-2">
          {formatDate(`${from}T00:00:00+07:00`)} – {formatDate(`${to}T00:00:00+07:00`)}
        </p>
      </div>

      <div className="flex gap-1 mb-3 overflow-x-auto" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={[
              "shrink-0 min-h-touch px-4 border-b-2 text-royal",
              tab === item.id ? "border-royal font-medium" : "border-transparent",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-royal">กำลังโหลดรายงาน…</p>}

      {!loading && error && <EmptyState title="โหลดรายงานไม่สำเร็จ" description={error} />}

      {!loading && !error && empty && (
        <EmptyState
          title="ไม่มีข้อมูลในช่วงวันที่ที่เลือก"
          description="ลองขยายช่วงวันที่ให้กว้างขึ้น หรือตรวจว่ามีการปิดบิลในช่วงนั้นหรือยัง"
        />
      )}

      {!loading && !error && !empty && tab === "daily" && (
        <>
          <div className="flex justify-end mb-2">
            <Button variant="primary" onClick={exportDaily}>
              ส่งออก CSV
            </Button>
          </div>

          <ReportTable<DailySummary>
            rows={daily}
            rowKey={(row) => row.sale_date}
            columns={[
              { header: "วันที่", cell: (r) => formatDate(`${r.sale_date}T00:00:00+07:00`) },
              { header: "บิล", align: "right", cell: (r) => formatQty(r.bill_count) },
              { header: "ยอดออกบิล", align: "right", cell: (r) => formatMoney(r.total_sales) },
              { header: "เงินคืน", align: "right", cell: (r) => formatMoney(r.refund_total) },
              { header: "ยอดขายสุทธิ", align: "right", cell: (r) => formatMoney(r.net_sales) },
              { header: "VAT", align: "right", cell: (r) => formatMoney(r.vat_total) },
              { header: "ส่วนลด", align: "right", cell: (r) => formatMoney(r.discount_total) },
              { header: "กำไรขั้นต้น", align: "right", cell: (r) => formatMoney(r.gross_profit) },
            ]}
          />
        </>
      )}

      {!loading && !error && !empty && tab === "products" && (
        <>
          <div className="flex justify-end mb-2">
            <Button variant="primary" onClick={exportProducts}>
              ส่งออก CSV
            </Button>
          </div>

          <ReportTable<ProductSalesRow>
            rows={products}
            rowKey={(row) => row.product_id}
            columns={[
              { header: "รหัสสินค้า", cell: (r) => <span className="num">{r.sku}</span> },
              { header: "ชื่อสินค้า", cell: (r) => r.name },
              { header: "หมวด", cell: (r) => r.category },
              { header: "ขายได้", align: "right", cell: (r) => formatQty(r.qty_sold) },
              { header: "ยอดขายสุทธิ", align: "right", cell: (r) => formatMoney(r.net_revenue) },
              { header: "ต้นทุน", align: "right", cell: (r) => formatMoney(r.net_cost) },
              { header: "กำไรขั้นต้น", align: "right", cell: (r) => formatMoney(r.gross_profit) },
            ]}
          />
        </>
      )}

      {!loading && !error && !empty && tab === "stock" && (
        <>
          <div className="flex justify-end mb-2">
            <Button variant="primary" onClick={exportStock}>
              ส่งออก CSV
            </Button>
          </div>

          <ReportTable<StockValueRow>
            rows={stock}
            rowKey={(row) => row.product_id}
            columns={[
              { header: "รหัสสินค้า", cell: (r) => <span className="num">{r.sku}</span> },
              { header: "ชื่อสินค้า", cell: (r) => r.name },
              { header: "หมวด", cell: (r) => r.category },
              {
                header: "คงเหลือ",
                align: "right",
                cell: (r) => (
                  <span>
                    {formatQty(r.quantity)} {r.unit}
                    {r.quantity <= r.reorder_point && (
                      <span className="ml-2">
                        <StatusBadge tone="warning">ถึงจุดสั่งซื้อ</StatusBadge>
                      </span>
                    )}
                  </span>
                ),
              },
              { header: "ทุน/หน่วย", align: "right", cell: (r) => formatMoney(r.cost_price) },
              { header: "ราคาขาย", align: "right", cell: (r) => formatMoney(r.price) },
              { header: "มูลค่าสต็อก", align: "right", cell: (r) => formatMoney(r.stock_value) },
            ]}
            footer={
              stockSummary && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 justify-end">
                  <span>
                    สินค้า <span className="num">{formatQty(stockSummary.product_count)}</span> รายการ
                  </span>
                  <span>
                    รวม <span className="num">{formatQty(stockSummary.total_quantity)}</span> ชิ้น
                  </span>
                  <span>
                    ถึงจุดสั่งซื้อ{" "}
                    <span className="num">{formatQty(stockSummary.low_stock_count)}</span> รายการ
                  </span>
                  <span className="font-medium">
                    มูลค่าสต็อกรวม{" "}
                    <span className="num">{formatMoney(stockSummary.total_value)}</span>
                  </span>
                </div>
              )
            }
          />
        </>
      )}

      {!loading && !error && (
        <p className="text-xs text-ink/60 mt-3">
          ไฟล์ CSV ของรายงานยอดขายไม่มีคอลัมน์ต้นทุนและกำไรขั้นต้นตาม §5 — ดูได้บนหน้าจอเท่านั้น ·
          ไฟล์เปิดด้วย Excel ได้ทันที ภาษาไทยไม่เพี้ยน
        </p>
      )}
    </div>
  );
}
