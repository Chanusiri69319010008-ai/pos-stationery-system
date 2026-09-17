// =====================================================================
// หน้า 3 — ประวัติการขาย (§5)
// owner เห็นทั้งร้าน / staff เห็นเฉพาะรอบขายของตัวเอง — บังคับที่ RLS
// ตัวกรองช่วงวัน · ค้นหาเลขที่บิล · สถานะบิล · แบ่งหน้า
// =====================================================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { paths } from "../routes/paths";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { SalesTable } from "../components/sales/SalesTable";
import type { SaleStatus } from "../types/db";

export function SalesHistoryPage() {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const { rows, total, page, pageCount, loading, error, applyFilter, goToPage } =
    useSalesHistory();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    document.title = "ประวัติการขาย — Aunchan";
  }, []);

  function search() {
    applyFilter({
      from: from === "" ? null : from,
      to: to === "" ? null : to,
      receiptNo: receiptNo.trim() === "" ? null : receiptNo.trim(),
      status: status === "" ? null : (status as SaleStatus),
    });
  }

  function clear() {
    setFrom("");
    setTo("");
    setReceiptNo("");
    setStatus("");
    applyFilter({ from: null, to: null, receiptNo: null, status: null });
  }

  return (
    <div className="max-w-6xl mx-auto p-3">
      <PageHeader
        title="ประวัติการขาย"
        description={
          isOwner
            ? "บิลทั้งหมดของร้าน"
            : "บิลของรอบขายที่คุณเป็นผู้ขายเท่านั้น"
        }
      />

      <div className="panel p-3 mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 items-end">
        <label className="block">
          <span className="block mb-1 text-sm">ตั้งแต่วันที่</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full min-h-touch num"
          />
        </label>

        <label className="block">
          <span className="block mb-1 text-sm">ถึงวันที่</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full min-h-touch num"
          />
        </label>

        <label className="block">
          <span className="block mb-1 text-sm">เลขที่บิล</span>
          <input
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="เช่น INV-2026-000012"
            className="w-full min-h-touch num"
          />
        </label>

        <label className="block">
          <span className="block mb-1 text-sm">สถานะบิล</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full min-h-touch"
          >
            <option value="">ทุกสถานะ</option>
            <option value="completed">สำเร็จ</option>
            <option value="partially_returned">คืนบางส่วน</option>
            <option value="returned">คืนทั้งบิล</option>
            <option value="voided">ยกเลิก</option>
          </select>
        </label>

        <div className="flex gap-2">
          <Button variant="primary" onClick={search}>
            ค้นหา
          </Button>
          <Button variant="secondary" onClick={clear}>
            ล้าง
          </Button>
        </div>
      </div>

      {loading && <p className="text-royal">กำลังโหลด…</p>}

      {!loading && error && <EmptyState title="โหลดข้อมูลไม่สำเร็จ" description={error} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="ไม่พบบิลตามเงื่อนไขที่ค้นหา"
          description="ลองล้างตัวกรอง หรือเปลี่ยนช่วงวันที่ให้กว้างขึ้น"
          action={
            <Button variant="primary" onClick={() => navigate(paths.pos)}>
              ไปหน้าขายสินค้า
            </Button>
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <SalesTable
            rows={rows}
            onOpenReceipt={(id) => navigate(paths.receiptOf(id))}
            onOpenReturn={
              isOwner ? (id) => navigate(`${paths.returns}?sale=${id}`) : undefined
            }
          />

          <div className="flex items-center justify-between gap-2 mt-3">
            <p className="text-sm text-ink/70 num">
              ทั้งหมด {total} บิล · หน้า {page} จาก {pageCount}
            </p>
            <div className="flex gap-2">
              <Button disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ก่อนหน้า
              </Button>
              <Button disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
                ถัดไป
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
