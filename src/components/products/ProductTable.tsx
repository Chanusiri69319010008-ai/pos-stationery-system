// ตารางจัดการสินค้า — owner เท่านั้น (§5 หน้า 6)
// ไม่มีปุ่มลบ สินค้าที่มีประวัติให้ปิดการใช้งานแทน (§4 ห้ามทำ ข้อ 4)
import { ImageOff } from "lucide-react";
import { formatMoney } from "../../lib/money";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import type { ProductWithStock } from "../../types/db";

export function ProductTable({
  products,
  onEdit,
  onToggleActive,
}: {
  products: ProductWithStock[];
  onEdit: (product: ProductWithStock) => void;
  onToggleActive: (product: ProductWithStock) => void;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">รูป</th>
            <th className="px-3 py-2 font-medium">รหัสสินค้า</th>
            <th className="px-3 py-2 font-medium">ชื่อสินค้า</th>
            <th className="px-3 py-2 font-medium">หมวด</th>
            <th className="px-3 py-2 font-medium text-right">ต้นทุน</th>
            <th className="px-3 py-2 font-medium text-right">ราคาขาย</th>
            <th className="px-3 py-2 font-medium text-right">คงเหลือ</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
            <th className="px-3 py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-t border-royal/15">
              <td className="px-3 py-2">
                <div className="w-10 h-10 rounded border border-royal/20 bg-powder/40 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageOff size={16} strokeWidth={1.5} className="text-ink/30" aria-hidden />
                  )}
                </div>
              </td>
              <td className="px-3 py-2 num">{product.sku}</td>
              <td className="px-3 py-2">
                <p>{product.name}</p>
                {product.barcode && (
                  <p className="num text-xs text-ink/60">{product.barcode}</p>
                )}
              </td>
              <td className="px-3 py-2">{product.category}</td>
              <td className="px-3 py-2 num text-right">{formatMoney(product.cost_price ?? 0)}</td>
              <td className="px-3 py-2 num text-right">{formatMoney(product.price)}</td>
              <td className="px-3 py-2 num text-right">
                {product.quantity} {product.unit}
              </td>
              <td className="px-3 py-2">
                {!product.is_active ? (
                  <StatusBadge>ปิดการใช้งาน</StatusBadge>
                ) : product.quantity <= product.reorder_point ? (
                  <StatusBadge tone="warning">ถึงจุดสั่งซื้อ</StatusBadge>
                ) : (
                  <StatusBadge>ขายอยู่</StatusBadge>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <Button onClick={() => onEdit(product)}>แก้ไข</Button>
                  <Button variant="ghost" onClick={() => onToggleActive(product)}>
                    {product.is_active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
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
