import Link from "next/link";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { RefreshButton } from "@/components/RefreshButton";
import {
  DAY_END,
  DAY_START,
  baht,
  dateTimeRange,
  fmtDate,
  fmtTime,
  parseDateParam,
  parseTimeParam,
} from "@/lib/format";
import { getNameMaps } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { ADJUST_REASON_LABEL, type AdjustReason } from "@/lib/types";
import { EditAdjustReason } from "../EditAdjustReason";

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
  adjustment_id: number | null;
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "purchase", label: "ของเข้า" },
  { key: "sale", label: "ขาย" },
  { key: "adjust", label: "ตัดออก" },
  { key: "void", label: "ยกเลิกบิล" },
] as const;

const PAGE_SIZE = 200;

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
  const fromTime = parseTimeParam(sp.from_time, DAY_START);
  const toTime = parseTimeParam(sp.to_time, DAY_END);
  const kind = typeof sp.kind === "string" ? sp.kind : "all";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const range = dateTimeRange(from, fromTime, to, toTime);
  // ลิงก์ตัวกรองประเภท / เปลี่ยนหน้า — คงช่วงวันที่/เวลาที่เลือกไว้ (เปลี่ยนประเภทแล้วกลับไปหน้า 1)
  const href = (k: string, p = 1) =>
    `?${new URLSearchParams({ from, from_time: fromTime, to, to_time: toTime, kind: k, ...(p > 1 && { page: String(p) }) })}`;

  const supabase = await createClient();
  // ดึงเกินมา 1 แถว ไว้รู้ว่ามีหน้าถัดไปไหม
  let query = supabase
    .from("stock_movements")
    .select("*")
    .gte("at", range.from)
    .lt("at", range.to)
    .order("at", { ascending: false })
    // เวลาเดียวกัน (สินค้าในบิล/รอบซื้อเดียวกัน) ต้องเรียงตายตัว ไม่งั้นข้ามหน้าแล้วแถวซ้ำ/หาย
    .order("kind")
    .order("sale_id", { ascending: false, nullsFirst: false })
    .order("product_id")
    .order("qty_change")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (kind === "adjust") query = query.like("kind", "adjust_%");
  else if (kind !== "all") query = query.eq("kind", kind);

  const [{ data, error }, names] = await Promise.all([query, getNameMaps(supabase)]);
  if (error) throw new Error(error.message);
  const hasNext = (data ?? []).length > PAGE_SIZE;
  const rows = ((data ?? []) as Movement[]).slice(0, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">ประวัติ stock</h1>
        <RefreshButton />
      </div>
      <DateRangeFilter from={from} to={to} fromTime={fromTime} toTime={toTime} extra={{ kind }} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key)}
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
                    {r.adjustment_id ? (
                      <EditAdjustReason
                        adjustmentId={r.adjustment_id}
                        reason={r.kind.replace("adjust_", "") as AdjustReason}
                        productName={names.productName.get(r.product_id) ?? ""}
                        qty={-r.qty_change}
                        note={r.note}
                      />
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.cls}`}>{k.text}</span>
                    )}
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

      {(page > 1 || hasNext) && (
        <nav className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={href(kind, page - 1)} className="btn-ghost">
              ← ก่อนหน้า
            </Link>
          ) : (
            <span className="btn-ghost pointer-events-none opacity-40">← ก่อนหน้า</span>
          )}
          <span className="text-stone-600">หน้า {page}</span>
          {hasNext ? (
            <Link href={href(kind, page + 1)} className="btn-ghost">
              ถัดไป →
            </Link>
          ) : (
            <span className="btn-ghost pointer-events-none opacity-40">ถัดไป →</span>
          )}
        </nav>
      )}
    </div>
  );
}
