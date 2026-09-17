// =====================================================================
// SalesChart — กราฟแท่งยอดขาย 7 วัน (§5 หน้า 5)
// ยอดทุกแท่งมาจาก view sales_daily_summary ฝั่งเซิร์ฟเวอร์
// การคำนวณในไฟล์นี้มีอย่างเดียวคือความสูงของแท่งเป็นสัดส่วนของค่าสูงสุด
// ซึ่งเป็นเรื่องการแสดงผล ไม่ใช่การคิดเงิน (§7.3)
// =====================================================================
import { formatMoney, parseMoney } from "../../lib/money";
import type { DailySummary } from "../../api/reports.api";

function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
  });
}

export function SalesChart({ daily }: { daily: DailySummary[] }) {
  // ใช้ยอดสุทธิ (หลังหักเงินคืน) ให้ตรงกับตัวเลขบนการ์ด "ยอดขายวันนี้"
  const values = daily.map((row) => parseMoney(row.net_sales));
  const max = Math.max(...values, 1);

  return (
    <div className="panel p-4">
      <h2 className="font-display text-xl text-royal mb-3">ยอดขายสุทธิ 7 วันล่าสุด</h2>

      <div className="flex items-end gap-2 h-48" role="img" aria-label="กราฟยอดขาย 7 วันล่าสุด">
        {daily.map((row, index) => (
          <div key={row.sale_date} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="num text-xs text-ink/70 mb-1">{formatMoney(row.net_sales)}</span>
            <div
              className="w-full bg-royal border border-royal"
              style={{ height: `${Math.max((values[index] / max) * 100, 2)}%` }}
            />
            <span className="num text-xs text-ink/60 mt-1">{dayLabel(row.sale_date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
