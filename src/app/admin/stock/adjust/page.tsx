import { baht, fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ADJUST_REASON_LABEL, type AdjustReason, type ProductWithCost } from "@/lib/types";
import { AdjustForm } from "./AdjustForm";

export default async function AdjustPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: recent }] = await Promise.all([
    supabase.from("products_admin").select("*").eq("is_active", true).order("sort_order").order("retail_price"),
    supabase
      .from("stock_adjustments")
      .select("id, qty, reason, note, unit_cost, created_at, products(name), profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type Row = {
    id: number;
    qty: number;
    reason: AdjustReason;
    note: string;
    unit_cost: number;
    created_at: string;
    products: { name: string } | null;
    profiles: { display_name: string } | null;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ตัด stock: ของเสีย / ชิม</h1>
      <AdjustForm products={(products ?? []) as ProductWithCost[]} />

      <section>
        <h2 className="mb-2 text-lg font-bold">รายการล่าสุด</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>วันเวลา</th>
                <th>สินค้า</th>
                <th>เหตุผล</th>
                <th className="text-right">จำนวน</th>
                <th className="text-right">มูลค่าทุน</th>
                <th>หมายเหตุ</th>
                <th>โดย</th>
              </tr>
            </thead>
            <tbody>
              {((recent ?? []) as unknown as Row[]).map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td>{r.products?.name}</td>
                  <td>{ADJUST_REASON_LABEL[r.reason]}</td>
                  <td className="text-right">{r.qty}</td>
                  <td className="text-right">{baht(Math.round(r.qty * r.unit_cost * 100) / 100)}</td>
                  <td className="max-w-xs truncate whitespace-normal">{r.note}</td>
                  <td>{r.profiles?.display_name}</td>
                </tr>
              ))}
              {(recent ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-stone-500">
                    ยังไม่มีรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
