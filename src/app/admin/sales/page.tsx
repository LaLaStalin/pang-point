import Link from "next/link";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { RangeTooLongNotice } from "@/components/RangeTooLongNotice";
import { RefreshButton } from "@/components/RefreshButton";
import { baht, dayRange, fmtDate, fmtTime, isRangeTooLong, parseDateParam } from "@/lib/format";
import { getNameMaps } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_LABEL, PRICE_TYPE_LABEL, type Sale } from "@/lib/types";

const PAGE_SIZE = 100;

type SalesPageSummary = { bill_count: number; total_qty: number; revenue: number; void_count: number };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to ?? sp.from);
  const range = dayRange(from, to);
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const pageHref = (p: number) => `?${new URLSearchParams({ from, to, page: String(p) })}`;

  if (isRangeTooLong(from, to)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">ประวัติรายการ</h1>
        <DateRangeFilter from={from} to={to} />
        <RangeTooLongNotice />
      </div>
    );
  }

  const supabase = await createClient();
  // ยอดรวมคิดในฐานข้อมูลจากทุกบิลในช่วง ตารางดึงแค่ทีละหน้า
  const [{ data, error }, { data: summaryData, error: summaryError }, names] = await Promise.all([
    supabase
      .from("sales")
      .select("*")
      .gte("sold_at", range.from)
      .lt("sold_at", range.to)
      .order("sold_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.rpc("sales_page_summary", { p_from: range.from, p_to: range.to }),
    getNameMaps(supabase),
  ]);
  if (error) throw new Error(error.message);
  if (summaryError) throw new Error(summaryError.message);
  const sales = (data ?? []) as Sale[];
  const summary = summaryData as SalesPageSummary;
  const pageCount = Math.max(1, Math.ceil((summary.bill_count + summary.void_count) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">ประวัติรายการ</h1>
        <RefreshButton />
      </div>
      <DateRangeFilter from={from} to={to} />
      <p className="text-stone-600">
        {summary.bill_count} บิล · {summary.total_qty} ชิ้น · <b>{baht(summary.revenue)} บาท</b>
        {summary.void_count > 0 && <span className="text-stone-400"> · ยกเลิก {summary.void_count} บิล</span>}
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

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-ghost">
              ← ก่อนหน้า
            </Link>
          ) : (
            <span className="btn-ghost pointer-events-none opacity-40">← ก่อนหน้า</span>
          )}
          <span className="text-stone-600">
            หน้า {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="btn-ghost">
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
