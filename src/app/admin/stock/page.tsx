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
                  <td className="font-semibold text-stone-900">{p.name}</td>
                  <td className="text-right text-stone-600">
                    {p.kind === "tier" ? (
                      <>
                        {baht(p.retail_price)}
                        <span className="text-stone-300"> / </span>
                        {baht(p.wholesale_price)}
                      </>
                    ) : (
                      baht(p.retail_price)
                    )}
                  </td>
                  <td className="text-right">
                    <span
                      className={`pill ${
                        p.qty_on_hand < 0
                          ? "bg-red-100 text-red-700"
                          : low
                            ? "bg-orange-100 text-orange-700"
                            : "bg-stone-100 text-stone-800"
                      }`}
                    >
                      {p.qty_on_hand}
                    </span>
                  </td>
                  <td className="text-right text-stone-600">{baht(p.avg_cost)}</td>
                  <td className="text-right text-stone-600">
                    {p.kind === "tier" ? (
                      <>
                        {baht(p.retail_price - p.avg_cost)}
                        <span className="text-stone-300"> / </span>
                        {baht(p.wholesale_price - p.avg_cost)}
                      </>
                    ) : (
                      baht(p.retail_price - p.avg_cost)
                    )}
                  </td>
                  <td className="text-right font-medium text-stone-900">{baht(Math.max(0, p.qty_on_hand) * p.avg_cost)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>รวม</td>
              <td />
              <td className="text-right">{totalQty}</td>
              <td colSpan={2} />
              <td className="text-right text-base">{baht(totalValue)} ฿</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-orange-400" /> ใกล้หมด
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500" /> ติดลบ = ขายไปก่อนบันทึกของเข้า (ควรเพิ่ม stock หรือเช็คของจริง)
        </span>
      </p>
    </div>
  );
}
