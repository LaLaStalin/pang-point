import { DateRangeFilter } from "@/components/DateRangeFilter";
import { RangeTooLongNotice } from "@/components/RangeTooLongNotice";
import { SummaryCards } from "@/components/SummaryCards";
import { baht, dayRange, isRangeTooLong, parseDateParam } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SalesSummary } from "@/lib/types";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to ?? sp.from);
  const range = dayRange(from, to);

  if (isRangeTooLong(from, to)) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">รายงานกำไร</h1>
        <DateRangeFilter from={from} to={to} />
        <RangeTooLongNotice />
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_summary", { p_from: range.from, p_to: range.to });
  if (error) throw new Error(error.message);
  const summary = data as SalesSummary;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">รายงานกำไร</h1>
      <DateRangeFilter from={from} to={to} />
      <SummaryCards summary={summary} />

      <section>
        <h2 className="mb-2 text-lg font-bold">แยกตามชนิด</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ชนิด</th>
                <th className="text-right">ขายได้ (ชิ้น)</th>
                <th className="text-right">ยอดขาย</th>
                <th className="text-right">ต้นทุน</th>
                <th className="text-right">กำไร</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_product.map((r) => (
                <tr key={r.product_id}>
                  <td>{r.name}</td>
                  <td className="text-right">{r.qty}</td>
                  <td className="text-right">{baht(r.revenue)}</td>
                  <td className="text-right">{baht(r.cost)}</td>
                  <td className="text-right font-semibold text-emerald-700">{baht(r.revenue - r.cost)}</td>
                </tr>
              ))}
              {summary.by_product.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500">
                    ไม่มียอดขายในช่วงนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-sm text-stone-500">
        กำไรขั้นต้น = ยอดขาย − ต้นทุนเฉลี่ยของที่ขาย (ยังไม่หักของเสีย/ชิม) · กำไรหลังหักของเสีย ={" "}
        <b>
          {baht(
            summary.revenue - summary.cost - summary.losses.reduce((s, l) => s + Number(l.cost), 0),
          )}{" "}
          บาท
        </b>
      </p>
    </div>
  );
}
