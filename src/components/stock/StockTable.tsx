// ตารางยอดคงเหลือ — อ่านอย่างเดียว (§5 หน้า 4)
import { formatMoney } from "../../lib/money";
import { StatusBadge } from "../ui/StatusBadge";
import type { ProductWithStock } from "../../types/db";

export function StockTable({ products }: { products: ProductWithStock[] }) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            <th className="px-3 py-2 font-medium">รหัสสินค้า</th>
            <th className="px-3 py-2 font-medium">ชื่อสินค้า</th>
            <th className="px-3 py-2 font-medium">หมวด</th>
            <th className="px-3 py-2 font-medium text-right">ราคา</th>
            <th className="px-3 py-2 font-medium text-right">คงเหลือ</th>
            <th className="px-3 py-2 font-medium text-right">จุดสั่งซื้อ</th>
            <th className="px-3 py-2 font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-t border-royal/15">
              <td className="px-3 py-2 num">{product.sku}</td>
              <td className="px-3 py-2">{product.name}</td>
              <td className="px-3 py-2">{product.category}</td>
              <td className="px-3 py-2 num text-right">{formatMoney(product.price)}</td>
              <td className="px-3 py-2 num text-right">
                {product.quantity} {product.unit}
              </td>
              <td className="px-3 py-2 num text-right">{product.reorder_point}</td>
              <td className="px-3 py-2">
                {!product.is_active ? (
                  <StatusBadge>ปิดการใช้งาน</StatusBadge>
                ) : product.quantity <= product.reorder_point ? (
                  <StatusBadge tone="warning">ถึงจุดสั่งซื้อ</StatusBadge>
                ) : (
                  <StatusBadge>ปกติ</StatusBadge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
