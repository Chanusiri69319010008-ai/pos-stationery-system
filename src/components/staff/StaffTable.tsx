// =====================================================================
// StaffTable — ตารางพนักงาน (§5 หน้า 12)
// แถวของตัวเองปิดปุ่มที่จะทำให้ล็อกตัวเองออกจากระบบ
// =====================================================================
import { formatDateTime } from "../../lib/datetime";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import type { Staff } from "../../types/db";

export function StaffTable({
  staff,
  currentStaffId,
  onEdit,
  onToggleActive,
}: {
  staff: Staff[];
  currentStaffId: string | null;
  onEdit: (person: Staff) => void;
  onToggleActive: (person: Staff) => void;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">ชื่อ</th>
            <th className="px-3 py-2 font-medium">อีเมล</th>
            <th className="px-3 py-2 font-medium">สิทธิ์</th>
            <th className="px-3 py-2 font-medium">เพิ่มเมื่อ</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((person) => {
            const isSelf = person.id === currentStaffId;
            return (
              <tr key={person.id} className="border-t border-royal/15">
                <td className="px-3 py-2">
                  {person.name}
                  {isSelf && <span className="ml-1 text-xs text-royal">(คุณ)</span>}
                </td>
                <td className="px-3 py-2">{person.email}</td>
                <td className="px-3 py-2">
                  {person.role === "owner" ? "เจ้าของร้าน" : "พนักงานขาย"}
                </td>
                <td className="px-3 py-2 num whitespace-nowrap">
                  {formatDateTime(person.created_at)}
                </td>
                <td className="px-3 py-2">
                  {person.is_active ? (
                    <StatusBadge tone="success">ใช้งานอยู่</StatusBadge>
                  ) : (
                    <StatusBadge>ปิดอยู่</StatusBadge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => onEdit(person)} disabled={isSelf}>
                      แก้ไข
                    </Button>
                    <Button onClick={() => onToggleActive(person)} disabled={isSelf}>
                      {person.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="px-3 py-2 text-xs text-ink/60 border-t border-royal/15">
        บัญชีของตัวเองแก้สิทธิ์และปิดไม่ได้ เพื่อกันเจ้าของร้านล็อกตัวเองออกจากระบบ ·
        ปิดบัญชีแล้วประวัติการขายเดิมของคนนั้นยังอยู่ครบ
      </p>
    </div>
  );
}
