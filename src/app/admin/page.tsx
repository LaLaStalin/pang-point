import Link from "next/link";
import { SummaryCards } from "@/components/SummaryCards";
import { dayRange, fmtDate, todayStr } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Product, SalesSummary } from "@/lib/types";

export default async function AdminHome() {
  const supabase = await createClient();
  const { from, to } = dayRange(todayStr());

  const [{ data: summary, error }, { data: products }] = await Promise.all([
    supabase.rpc("sales_summary", { p_from: from, p_to: to }),
    supabase.from("products").select("*").eq("is_active", true).order("sort_order").order("retail_price"),
  ]);
  if (error) throw new Error(error.message);

  const lowStock = ((products ?? []) as Product[]).filter((p) => p.qty_on_hand <= p.low_stock_threshold);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">วันนี้ {fmtDate(from)}</h1>
      <SummaryCards summary={summary as SalesSummary} />

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">ของใกล้หมด</h2>
          <Link href="/admin/stock/add" className="btn-primary px-3 py-1.5 text-sm">
            + เพิ่ม stock
          </Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="text-stone-500">ยังมีของพอทุกอย่าง</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.name}</span>
                <span className={p.qty_on_hand <= 0 ? "font-bold text-red-600" : "font-semibold text-orange-600"}>
                  เหลือ {p.qty_on_hand} ชิ้น
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
