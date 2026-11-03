import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
  DAY_END,
  DAY_START,
  baht,
  dateTimeRange,
  fmtDateTime,
  parseDateParam,
  parseTimeParam,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AdjustReason, ProductWithCost } from "@/lib/types";
import { EditAdjustReason } from "../EditAdjustReason";
import { AdjustBatchForm } from "./AdjustBatchForm";
import { AdjustRequests } from "./AdjustRequests";

const REQUESTS_PER_PAGE = 10;

export default async function AdjustPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // ค่าเริ่มต้นแสดงคำขอที่รอทั้งหมด ไม่กรองแค่วันนี้ — คำขอเก่าที่ยังไม่อนุมัติจะได้ไม่ถูกซ่อน
  const filtered = typeof sp.from === "string";
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to ?? sp.from);
  const fromTime = parseTimeParam(sp.from_time, DAY_START);
  const toTime = parseTimeParam(sp.to_time, DAY_END);
  const range = dateTimeRange(from, fromTime, to, toTime);

  const supabase = await createClient();
  const [{ data: products }, { data: recent }, { count }] = await Promise.all([
    supabase.from("products_admin").select("*").eq("is_active", true).order("sort_order").order("retail_price"),
    supabase
      .from("stock_adjustments")
      .select("id, qty, reason, note, unit_cost, created_at, products(name), profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(20),
    filtered
      ? supabase
          .from("stock_adjustment_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gte("created_at", range.from)
          .lt("created_at", range.to)
      : supabase
          .from("stock_adjustment_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
  ]);

  // อนุมัติรายการสุดท้ายของหน้าสุดท้ายแล้วหน้านั้นจะหายไป จึงถอยมาหน้าสุดท้ายที่ยังมีอยู่
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / REQUESTS_PER_PAGE));
  const page = Math.min(lastPage, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const pageHref = (p: number) =>
    `?${new URLSearchParams({
      ...(filtered && { from, from_time: fromTime, to, to_time: toTime }),
      ...(p > 1 && { page: String(p) }),
    })}`;

  let requestQuery = supabase
    .from("stock_adjustment_requests")
    .select("id, product_id, qty, reason, note, created_at")
    .eq("status", "pending");
  if (filtered) requestQuery = requestQuery.gte("created_at", range.from).lt("created_at", range.to);
  // รายการเก่าสุดขึ้นก่อน (id กันลำดับสลับเมื่อเวลาเท่ากัน)
  const { data: requestRows } =
    total > 0
      ? await requestQuery
          .order("created_at")
          .order("id")
          .range((page - 1) * REQUESTS_PER_PAGE, page * REQUESTS_PER_PAGE - 1)
      : { data: [] };

  const productById = new Map(((products ?? []) as ProductWithCost[]).map((p) => [p.id, p]));
  const requests = (requestRows ?? []).map((r) => {
    const product = productById.get(r.product_id);
    return {
      ...r,
      // สินค้าที่ถูกซ่อนหลังส่งคำขอจะไม่อยู่ในรายการ แต่ยังต้องจัดการคำขอได้
      name: product?.name ?? `สินค้า #${r.product_id}`,
      qty_on_hand: product?.qty_on_hand ?? 0,
      avg_cost: product?.avg_cost ?? 0,
    };
  });

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
      <AutoRefresh />
      {(total > 0 || filtered) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">
            คำขอจากหน้าร้าน รออนุมัติ ({total})
            {filtered && <span className="ml-1 text-sm font-normal text-stone-500">ในช่วงที่เลือก</span>}
          </h2>
          <DateRangeFilter from={from} to={to} fromTime={fromTime} toTime={toTime} />
          {filtered && (
            <Link href="?" className="inline-block text-sm text-amber-700 underline">
              ดูคำขอที่รอทั้งหมด
            </Link>
          )}
          {requests.length > 0 ? (
            <AdjustRequests requests={requests} />
          ) : (
            <p className="card py-6 text-center text-stone-500">ไม่มีคำขอในช่วงนี้</p>
          )}
          {lastPage > 1 && (
            <nav className="flex items-center justify-center gap-3">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn-ghost">
                  ← ก่อนหน้า
                </Link>
              ) : (
                <span className="btn-ghost pointer-events-none opacity-40">← ก่อนหน้า</span>
              )}
              <span className="text-stone-600">
                หน้า {page} / {lastPage}
              </span>
              {page < lastPage ? (
                <Link href={pageHref(page + 1)} className="btn-ghost">
                  ถัดไป →
                </Link>
              ) : (
                <span className="btn-ghost pointer-events-none opacity-40">ถัดไป →</span>
              )}
            </nav>
          )}
        </section>
      )}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">แอดมินตัด stock เอง</h2>
          <p className="text-sm text-stone-500">เลือกได้หลายรายการ กดยืนยันแล้ว stock ลดทันที ไม่ต้องรออนุมัติ</p>
        </div>
        <AdjustBatchForm products={(products ?? []) as ProductWithCost[]} />
      </section>

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
                  <td>
                    <EditAdjustReason
                      adjustmentId={r.id}
                      reason={r.reason}
                      productName={r.products?.name ?? ""}
                      qty={r.qty}
                      note={r.note}
                    />
                  </td>
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
