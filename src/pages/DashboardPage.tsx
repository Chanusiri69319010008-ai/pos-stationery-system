// =====================================================================
// หน้า 5 — Dashboard (owner เท่านั้น) (§5)
// ยอดขายวันนี้ · กำไรขั้นต้น · จำนวนบิล · กราฟยอดขาย 7 วัน · สินค้าถึงจุดสั่งซื้อ
// ทุกยอดอ่านจาก view sales_daily_summary ไม่มีการบวกเลขในเบราว์เซอร์ (§7.3)
// กำไรขั้นต้นแสดงบนจอเท่านั้น ไม่ส่งออก CSV (§5 หน้า 11)
// =====================================================================
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { formatMoney } from "../lib/money";
import { formatDate } from "../lib/datetime";
import { paths } from "../routes/paths";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { StatTile } from "../components/dashboard/StatTile";
import { SalesChart } from "../components/dashboard/SalesChart";

export function DashboardPage() {
  const navigate = useNavigate();
  const { daily, today, lowStock, loading, error, refresh } = useDashboard(7);

  useEffect(() => {
    document.title = "Dashboard — Aunchan";
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-3">
      <PageHeader
        title="Dashboard"
        description="ภาพรวมของร้านวันนี้และย้อนหลัง 7 วัน"
        actions={<Button onClick={() => void refresh()}>โหลดใหม่</Button>}
      />

      {loading && <p className="text-royal">กำลังโหลด…</p>}
      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <StatTile
              label="ยอดขายวันนี้"
              value={formatMoney(today?.net_sales ?? 0)}
              hint={
                today
                  ? `ออกบิล ${formatMoney(today.total_sales)} · คืนลูกค้า ${formatMoney(
                      today.refund_total,
                    )} · รวม VAT ${formatMoney(today.vat_total)}`
                  : "ยังไม่มีบิลวันนี้"
              }
            />
            <StatTile
              label="กำไรขั้นต้นวันนี้"
              value={formatMoney(today?.gross_profit ?? 0)}
              hint="รายได้หลังหักส่วนที่คืนแล้ว ลบด้วยต้นทุน ณ เวลาขาย"
            />
            <StatTile
              label="จำนวนบิลวันนี้"
              value={String(today?.bill_count ?? 0)}
              hint={today ? `ส่วนลดรวม ${formatMoney(today.discount_total)}` : undefined}
            />
          </div>

          {daily.length > 0 ? (
            <div className="mb-3">
              <SalesChart daily={daily} />
            </div>
          ) : (
            <div className="mb-3">
              <EmptyState
                title="ยังไม่มียอดขายให้แสดง"
                description="เมื่อมีการปิดบิล ยอดขายรายวันจะขึ้นที่นี่อัตโนมัติ"
                action={
                  <Button variant="primary" onClick={() => navigate(paths.pos)}>
                    ไปหน้าขายสินค้า
                  </Button>
                }
              />
            </div>
          )}

          <div className="panel p-4">
            <h2 className="font-display text-xl text-royal mb-3">สินค้าถึงจุดสั่งซื้อ</h2>

            {lowStock.length === 0 ? (
              <p className="text-ink/70">ไม่มีสินค้าที่ถึงจุดสั่งซื้อ สต็อกทุกตัวยังอยู่เหนือเกณฑ์</p>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr className="bg-powder text-royal text-left">
                      <th className="px-3 py-2 font-medium">รหัสสินค้า</th>
                      <th className="px-3 py-2 font-medium">ชื่อสินค้า</th>
                      <th className="px-3 py-2 font-medium">หมวด</th>
                      <th className="px-3 py-2 font-medium text-right">คงเหลือ</th>
                      <th className="px-3 py-2 font-medium text-right">จุดสั่งซื้อ</th>
                      <th className="px-3 py-2 font-medium">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((item) => (
                      <tr key={item.product_id} className="border-t border-royal/15">
                        <td className="px-3 py-2 num">{item.sku}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.category}</td>
                        <td className="px-3 py-2 num text-right">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-3 py-2 num text-right">{item.reorder_point}</td>
                        <td className="px-3 py-2">
                          <StatusBadge tone="warning">ถึงจุดสั่งซื้อ</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3">
              <Button onClick={() => navigate(paths.stockManage)}>ไปหน้ารับสินค้าเข้า</Button>
            </div>
          </div>

          {daily.length > 0 && (
            <p className="text-xs text-ink/60 mt-3">
              ข้อมูลล่าสุดถึงวันที่ {formatDate(`${daily[daily.length - 1].sale_date}T00:00:00+07:00`)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
