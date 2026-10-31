import Link from "next/link";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { baht, dayRange, fmtDate, fmtTime, parseDateParam } from "@/lib/format";
import { getNameMaps } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { ADJUST_REASON_LABEL, type AdjustReason } from "@/lib/types";

type Movement = {
  kind: string;
  at: string;
  product_id: number;
  qty_change: number;
  unit_cost: number;
  note: string | null;
  user_id: string;
  sale_id: number | null;
  supplier: string | null;
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "purchase", label: "ของเข้า" },
  { key: "sale", label: "ขาย" },
  { key: "adjust", label: "ตัดออก" },
  { key: "void", label: "ยกเลิกบิล" },
] as const;

function kindLabel(kind: string) {
  if (kind === "purchase") return { text: "ของเข้า", cls: "bg-emerald-100 text-emerald-800" };
  if (kind === "sale") return { text: "ขาย", cls: "bg-sky-100 text-sky-800" };
  if (kind === "void") return { text: "ยกเลิกบิล", cls: "bg-stone-200 text-stone-700" };
  const reason = kind.replace("adjust_", "") as AdjustReason;
  return { text: ADJUST_REASON_LABEL[reason] ?? kind, cls: "bg-red-100 text-red-800" };
}

export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to ?? sp.from);
  const kind = typeof sp.kind === "string" ? sp.kind : "all";
  const range = dayRange(from, to);

  const supabase = await createClient();
  let query = supabase
    .from("stock_movements")
    .select("*")
    .gte("at", range.from)
    .lt("at", range.to)
    .order("at", { ascending: false })
    .limit(500);
  if (kind === "adjust") query = query.like("kind", "adjust_%");
  else if (kind !== "all") query = query.eq("kind", kind);

  const [{ data, error }, names] = await Promise.all([query, getNameMaps(supabase)]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Movement[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ประวัติ stock</h1>
      <DateRangeFilter from={from} to={to} extra={{ kind }} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`?from=${from}&to=${to}&kind=${f.key}`}
            className={`rounded-full px-3 py-1 text-sm ${kind === f.key ? "bg-stone-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>เวลา</th>
              <th>ประเภท</th>
              <th>ชนิด</th>
              <th className="text-right">จำนวน</th>
              <th className="text-right">ทุน/ชิ้น</th>
              <th>หมายเหตุ</th>
              <th>โดย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const k = kindLabel(r.kind);
              return (
                <tr key={i}>
                  <td>{fmtDate(r.at)}</td>
                  <td>{fmtTime(r.at)}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.cls}`}>{k.text}</span>
                  </td>
                  <td>{names.productName.get(r.product_id)}</td>
                  <td className={`text-right font-semibold ${r.qty_change > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {r.qty_change > 0 ? `+${r.qty_change}` : r.qty_change}
                  </td>
                  <td className="text-right">{baht(r.unit_cost)}</td>
                  <td className="whitespace-normal">
                    {r.sale_id ? (
                      <Link href={`/admin/sales/${r.sale_id}`} className="text-amber-700 underline">
                        บิล #{r.sale_id}
                      </Link>
                    ) : null}
                    {r.supplier && <b>{r.supplier}</b>}
                    {(r.sale_id || r.supplier) && r.note ? " · " : null}
                    {r.note}
                  </td>
                  <td>{names.userName.get(r.user_id)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
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
