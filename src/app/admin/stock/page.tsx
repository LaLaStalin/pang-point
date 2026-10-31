import Link from "next/link";
import { baht } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithCost } from "@/lib/types";

export default async function StockPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products_admin")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("retail_price");
  const products = (data ?? []) as ProductWithCost[];

  const totalQty = products.reduce((s, p) => s + Math.max(0, p.qty_on_hand), 0);
  const totalValue = products.reduce((s, p) => s + Math.max(0, p.qty_on_hand) * p.avg_cost, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">เช็ค stock</h1>
        <Link href="/admin/stock/add" className="btn-primary">
          + เพิ่ม stock
        </Link>
        <Link href="/admin/stock/adjust" className="btn-ghost">
          ตัดของเสีย/ชิม
        </Link>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>สินค้า</th>
              <th className="text-right">ปลีก / ส่ง</th>
              <th className="text-right">คงเหลือ</th>
              <th className="text-right">ทุนเฉลี่ย/ชิ้น</th>
              <th className="text-right">กำไร/ชิ้น (ปลีก / ส่ง)</th>
              <th className="text-right">มูลค่าทุนคงเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const low = p.qty_on_hand <= p.low_stock_threshold;
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-right">
                    {p.kind === "tier" ? `${baht(p.retail_price)} / ${baht(p.wholesale_price)}` : baht(p.retail_price)}
                  </td>
                  <td
                    className={`text-right text-base font-bold ${p.qty_on_hand < 0 ? "text-red-600" : low ? "text-orange-600" : ""}`}
                  >
                    {p.qty_on_hand}
                  </td>
                  <td className="text-right">{baht(p.avg_cost)}</td>
                  <td className="text-right">
                    {p.kind === "tier"
                      ? `${baht(p.retail_price - p.avg_cost)} / ${baht(p.wholesale_price - p.avg_cost)}`
                      : baht(p.retail_price - p.avg_cost)}
                  </td>
                  <td className="text-right">{baht(Math.max(0, p.qty_on_hand) * p.avg_cost)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="border-t border-stone-200 px-3 py-2">รวม</td>
              <td className="border-t border-stone-200" />
              <td className="border-t border-stone-200 px-3 py-2 text-right">{totalQty}</td>
              <td className="border-t border-stone-200" colSpan={2} />
              <td className="border-t border-stone-200 px-3 py-2 text-right">{baht(totalValue)} ฿</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-stone-500">
        ตัวเลขสีส้ม = ใกล้หมด, สีแดงติดลบ = ขายไปก่อนบันทึกของเข้า (ควรเพิ่ม stock หรือเช็คของจริง)
      </p>
    </div>
  );
}
