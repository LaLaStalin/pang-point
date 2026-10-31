import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { RefreshButton } from "@/components/RefreshButton";
import { SummaryCards } from "@/components/SummaryCards";
import {
  DAY_END,
  DAY_START,
  dateTimeRange,
  dayRange,
  fmtDate,
  parseDateParam,
  parseTimeParam,
  todayStr,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Product, SalesSummary } from "@/lib/types";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // ค่าเริ่มต้น = วันนี้ทั้งวัน / เลือกช่วงวันและเวลาอื่นได้
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to ?? sp.from);
  const fromTime = parseTimeParam(sp.from_time, DAY_START);
  const toTime = parseTimeParam(sp.to_time, DAY_END);
  const range = dateTimeRange(from, fromTime, to, toTime);
  const today = todayStr();
  const wholeDay = fromTime === DAY_START && toTime === DAY_END;
  const isToday = from === today && to === today && wholeDay;
  const fromLabel = fmtDate(dayRange(from).from);
  const toLabel = fmtDate(dayRange(to).from);
  const dayLabel = from === today ? `วันนี้ ${fromLabel}` : `วันที่ ${fromLabel}`;
  const title =
    from === to
      ? wholeDay
        ? dayLabel
        : `${dayLabel} ${fromTime}–${toTime}`
      : wholeDay
        ? `${fromLabel} – ${toLabel}`
        : `${fromLabel} ${fromTime} – ${toLabel} ${toTime}`;

  const supabase = await createClient();
  const [{ data: summary, error }, { data: products }] = await Promise.all([
    supabase.rpc("sales_summary", { p_from: range.from, p_to: range.to }),
    supabase.from("products").select("*").eq("is_active", true).order("sort_order").order("retail_price"),
  ]);
  if (error) throw new Error(error.message);

  const lowStock = ((products ?? []) as Product[]).filter((p) => p.qty_on_hand <= p.low_stock_threshold);

  return (
    <div className="space-y-6">
      {/* รีเฟรชเองเฉพาะตอนช่วงที่ดูมีวันนี้ (ยอดยังเปลี่ยนได้) */}
      {to >= today && <AutoRefresh />}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <RefreshButton />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {/* key: กด "กลับไปดูวันนี้" แล้วช่องวันที่ต้องรีเซ็ตตาม */}
        <DateRangeFilter
          key={`${from}_${fromTime}_${to}_${toTime}`}
          from={from}
          to={to}
          fromTime={fromTime}
          toTime={toTime}
        />
        {!isToday && (
          <Link href="/admin" className="btn-ghost">
            กลับไปดูวันนี้
          </Link>
        )}
      </div>
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
