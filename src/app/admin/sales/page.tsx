import Link from "next/link";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { baht, dayRange, fmtDate, fmtTime, parseDateParam } from "@/lib/format";
import { getNameMaps } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_LABEL, PRICE_TYPE_LABEL, type Sale } from "@/lib/types";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to ?? sp.from);
  const range = dayRange(from, to);

  const supabase = await createClient();
  const [{ data, error }, names] = await Promise.all([
    supabase
      .from("sales")
      .select("*")
      .gte("sold_at", range.from)
      .lt("sold_at", range.to)
      .order("sold_at", { ascending: false })
      .limit(1000),
    getNameMaps(supabase),
  ]);
  if (error) throw new Error(error.message);
  const sales = (data ?? []) as Sale[];
  const completed = sales.filter((s) => s.status === "completed");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ประวัติรายการ</h1>
      <DateRangeFilter from={from} to={to} />
      <p className="text-stone-600">
        {completed.length} บิล · {completed.reduce((s, x) => s + x.total_qty, 0)} ชิ้น ·{" "}
        <b>{baht(completed.reduce((s, x) => s + Number(x.total_amount), 0))} บาท</b>
      </p>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>บิล</th>
              <th>วันที่</th>
              <th>เวลา</th>
              <th>ประเภท</th>
              <th className="text-right">จำนวน</th>
              <th className="text-right">รวม</th>
              <th>ชำระ</th>
              <th>ผู้ขาย</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => {
              const isVoid = s.status === "void";
              return (
                <tr key={s.id} className={isVoid ? "text-stone-400 line-through" : ""}>
                  <td>
                    <Link href={`/admin/sales/${s.id}`} className="text-amber-700 underline">
                      #{s.id}
                    </Link>
                    {isVoid && <span className="ml-1 text-xs text-red-600 no-underline">ยกเลิก</span>}
                  </td>
                  <td>{fmtDate(s.sold_at)}</td>
                  <td>{fmtTime(s.sold_at)}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.price_type === "retail" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {PRICE_TYPE_LABEL[s.price_type]}
                    </span>
                  </td>
                  <td className="text-right">{s.total_qty}</td>
                  <td className="text-right font-semibold">{baht(s.total_amount)}</td>
                  <td>{PAYMENT_LABEL[s.payment_method]}</td>
                  <td>{names.userName.get(s.sold_by)}</td>
                </tr>
              );
            })}
            {sales.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-stone-500">
                  ไม่มีรายการในช่วงนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
