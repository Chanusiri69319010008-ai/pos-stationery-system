// =====================================================================
// SupplierTable — ตารางซัพพลายเออร์ (§5 หน้า 10)
// =====================================================================
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import type { SupplierWithUsage } from "../../api/suppliers.api";

export function SupplierTable({
  suppliers,
  onEdit,
  onToggleActive,
}: {
  suppliers: SupplierWithUsage[];
  onEdit: (supplier: SupplierWithUsage) => void;
  onToggleActive: (supplier: SupplierWithUsage) => void;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">ชื่อซัพพลายเออร์</th>
            <th className="px-3 py-2 font-medium">เบอร์ติดต่อ</th>
            <th className="px-3 py-2 font-medium">อีเมล</th>
            <th className="px-3 py-2 font-medium">บันทึกช่วยจำ</th>
            <th className="px-3 py-2 font-medium text-right">สินค้าที่ผูกไว้</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="border-t border-royal/15">
              <td className="px-3 py-2">{supplier.name}</td>
              <td className="px-3 py-2 num whitespace-nowrap">{supplier.contact ?? "-"}</td>
              <td className="px-3 py-2">{supplier.email ?? "-"}</td>
              <td className="px-3 py-2 text-sm text-ink/80">{supplier.note ?? "-"}</td>
              <td className="px-3 py-2 num text-right">{supplier.product_count}</td>
              <td className="px-3 py-2">
                {supplier.is_active ? (
                  <StatusBadge tone="success">ใช้งานอยู่</StatusBadge>
                ) : (
                  <StatusBadge>ปิดอยู่</StatusBadge>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <Button onClick={() => onEdit(supplier)}>แก้ไข</Button>
                  <Button onClick={() => onToggleActive(supplier)}>
                    {supplier.is_active ? "ปิด" : "เปิด"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
