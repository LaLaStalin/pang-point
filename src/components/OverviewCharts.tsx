import dayjs from "dayjs";
import { baht } from "@/lib/format";
import type { SalesSummary } from "@/lib/types";

export type DailySales = { day: string; revenue: number; cost: number; bills: number };

/** ปัดค่าสูงสุดของแกนให้เป็นเลขกลมๆ (100, 250, 500, 1,000, 2,500 ...) */
export function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * p >= v) ?? 10;
  return step * p;
}

const compact = (n: number) => (n >= 10_000 ? `${baht(Math.round(n / 100) / 10)}K` : baht(n));

export const TH_DAY = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** กราฟแท่งยอดขายรายวัน — วางเมาส์/แตะแท่งเพื่อดูยอด กำไร และจำนวนบิล */
export function DailySalesChart({
  data,
  highlight,
  failed = false,
}: {
  data: DailySales[];
  highlight: string;
  failed?: boolean;
}) {
  const max = niceMax(Math.max(...data.map((d) => d.revenue)));
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const ticks = [max, max / 2, 0];

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">ยอดขายรายวัน</h2>
          <p className="text-sm text-stone-500">
            {data.length} วันล่าสุด ถึง {dayjs(highlight).format("DD/MM/BB")}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-stone-500">รวม {data.length} วัน</div>
          <div className="text-xl font-bold">{baht(total)} ฿</div>
        </div>
      </div>

      {failed ? (
        <p className="py-10 text-center text-stone-500">โหลดกราฟไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>
      ) : total === 0 ? (
        <p className="py-10 text-center text-stone-500">ยังไม่มียอดขายในช่วงนี้</p>
      ) : (
        <div className="flex gap-2">
          {/* แกนตั้ง */}
          <div className="flex h-48 flex-col justify-between text-right text-[11px] text-stone-400 tabular-nums">
            {ticks.map((t) => (
              <span key={t} className="-translate-y-1/2 leading-none last:translate-y-1/2">
                {compact(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-48">
              {/* เส้นกริด */}
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 h-px ${t === 0 ? "bg-stone-300" : "bg-stone-100"}`}
                  style={{ bottom: `${(t / max) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex items-end">
                {data.map((d, i) => {
                  const isHighlight = d.day === highlight;
                  const profit = d.revenue - d.cost;
                  // ทูลทิปชิดขอบซ้าย/ขวา ไม่ให้ล้นกรอบ
                  const align =
                    i < 2 ? "left-0" : i > data.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
                  return (
                    <button
                      key={d.day}
                      type="button"
                      className="group relative flex h-full flex-1 items-end justify-center outline-none"
                      aria-label={`${dayjs(d.day).format("DD/MM/BB")} ยอดขาย ${baht(d.revenue)} บาท กำไร ${baht(profit)} บาท ${d.bills} บิล`}
                    >
                      <span className="absolute inset-x-0 inset-y-0 rounded-md transition group-hover:bg-amber-50 group-focus-visible:bg-amber-50" />
                      <span
                        className={`relative w-full max-w-6 rounded-t ${
                          isHighlight ? "bg-amber-500" : "bg-amber-300 group-hover:bg-amber-400"
                        }`}
                        style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue > 0 ? 2 : 0 }}
                      />
                      {isHighlight && d.revenue > 0 && (
                        <span
                          className="absolute text-[11px] font-semibold whitespace-nowrap text-stone-700 tabular-nums"
                          style={{ bottom: `calc(${(d.revenue / max) * 100}% + 4px)` }}
                        >
                          {compact(d.revenue)}
                        </span>
                      )}
                      <span
                        className={`pointer-events-none absolute bottom-full z-10 mb-2 w-40 rounded-xl bg-stone-900 px-3 py-2 text-left text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 ${align}`}
                      >
                        <span className="block font-semibold">
                          {TH_DAY[dayjs(d.day).day()]} {dayjs(d.day).format("DD/MM/BB")}
                        </span>
                        <span className="mt-1 flex justify-between">
                          <span className="text-stone-300">ยอดขาย</span> {baht(d.revenue)} ฿
                        </span>
                        <span className="flex justify-between">
                          <span className="text-stone-300">กำไร</span> {baht(profit)} ฿
                        </span>
                        <span className="flex justify-between">
                          <span className="text-stone-300">บิล</span> {d.bills}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* แกนนอน: วันที่ */}
            <div className="mt-1.5 flex text-[11px] text-stone-400 tabular-nums">
              {data.map((d) => (
                <span
                  key={d.day}
                  className={`flex-1 text-center ${d.day === highlight ? "font-semibold text-stone-700" : ""}`}
                >
                  {dayjs(d.day).format("D")}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** แท่งแนวนอน: ยอดขายแต่ละชนิดในช่วงที่เลือก เรียงจากมากไปน้อย */
export function ProductSalesChart({ rows, rangeLabel }: { rows: SalesSummary["by_product"]; rangeLabel: string }) {
  const sorted = [...rows].map((r) => ({ ...r, revenue: Number(r.revenue) })).sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(...sorted.map((r) => r.revenue), 1);

  return (
    <section className="card">
      <div className="mb-4">
        <h2 className="text-lg font-bold">ขายดีตามชนิด</h2>
        <p className="text-sm text-stone-500">{rangeLabel}</p>
      </div>
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-stone-500">ยังไม่มียอดขายในช่วงนี้</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => (
            <li key={r.product_id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-stone-700">{r.name}</span>
                <span className="shrink-0 text-stone-500 tabular-nums">
                  <b className="text-stone-800">{baht(r.revenue)} ฿</b> · {r.qty} ชิ้น
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.max((r.revenue / max) * 100, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
