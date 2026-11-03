"use client";

import dayjs from "dayjs";
import { useState } from "react";
import { TH_DAY, niceMax } from "@/components/OverviewCharts";
import { baht } from "@/lib/format";

export type DailyMovement = {
  day: string;
  purchase_qty: number;
  sale_qty: number;
  adjust_qty: number;
  void_qty: number;
};

// ชุดสีผ่านการตรวจตาบอดสีและความตัดกับพื้นขาว — ยกเลิกบิลใช้ม่วงแทนเทา เพราะเทาแยกจากแดงได้ยาก
const CHARTS = [
  { key: "purchase_qty", title: "ของเข้า", bar: "bg-emerald-600" },
  { key: "sale_qty", title: "ขาย", bar: "bg-sky-600" },
  { key: "adjust_qty", title: "ตัดออก", bar: "bg-red-600" },
  { key: "void_qty", title: "ยกเลิกบิล", bar: "bg-violet-600" },
] as const;

const fmtDay = (day: string) => `${TH_DAY[dayjs(day).day()]} ${dayjs(day).format("DD/MM/BB")}`;

/** กราฟแท่งรายวัน 4 ประเภท — แตะหรือวางเมาส์ที่วันไหน ทุกกราฟจะแสดงตัวเลขของวันนั้นพร้อมเทียบวันก่อนหน้า */
export function StockDailyCharts({
  data,
  initialDay,
  failed = false,
}: {
  data: DailyMovement[];
  initialDay: string;
  failed?: boolean;
}) {
  const [selected, setSelected] = useState(initialDay);
  const [hovered, setHovered] = useState<string | null>(null);
  const activeDay = hovered ?? selected;

  if (failed) {
    return <p className="card py-10 text-center text-stone-500">โหลดกราฟไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-lg font-bold">สรุปรายวัน: {fmtDay(activeDay)}</h2>
        <p className="text-sm text-stone-500">
          {data.length} วัน นับเป็นจำนวนชิ้น แตะแท่งกราฟเพื่อดูและเทียบวันอื่น
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CHARTS.map((c) => (
          <DayChart
            key={c.key}
            title={c.title}
            barClass={c.bar}
            days={data.map((d) => ({ day: d.day, qty: d[c.key] }))}
            activeDay={activeDay}
            onSelect={setSelected}
            onHover={setHovered}
          />
        ))}
      </div>
    </section>
  );
}

function DayChart({
  title,
  barClass,
  days,
  activeDay,
  onSelect,
  onHover,
}: {
  title: string;
  barClass: string;
  days: { day: string; qty: number }[];
  activeDay: string;
  onSelect: (day: string) => void;
  onHover: (day: string | null) => void;
}) {
  const index = days.findIndex((d) => d.day === activeDay);
  const qty = days[index]?.qty ?? 0;
  const diff = index > 0 ? qty - days[index - 1].qty : null;
  const total = days.reduce((s, d) => s + d.qty, 0);
  const max = niceMax(Math.max(...days.map((d) => d.qty)));
  // เส้นกลางแกนแสดงเมื่อเป็นจำนวนเต็ม เพราะนับเป็นชิ้น
  const ticks = max % 2 === 0 ? [max, max / 2, 0] : [max, 0];
  // ช่วงยาวแสดงเลขวันเว้นระยะ ไม่ให้ตัวเลขชนกัน
  const labelEvery = Math.ceil(days.length / 14);

  return (
    <section className="card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-stone-500">
            รวม {days.length} วัน {baht(total)} ชิ้น
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">{baht(qty)} ชิ้น</div>
          <div className="text-xs text-stone-500">
            {diff === null
              ? "ไม่มีวันก่อนหน้าให้เทียบ"
              : diff === 0
                ? "เท่ากับวันก่อนหน้า"
                : `${diff > 0 ? "+" : ""}${baht(diff)} จากวันก่อนหน้า`}
          </div>
        </div>
      </div>

      {total === 0 ? (
        <p className="py-14 text-center text-sm text-stone-500">ไม่มีรายการในช่วงนี้</p>
      ) : (
        <div className="flex gap-2">
          <div className="flex h-36 flex-col justify-between text-right text-[11px] text-stone-400 tabular-nums">
            {ticks.map((t) => (
              <span key={t} className="-translate-y-1/2 leading-none last:translate-y-1/2">
                {baht(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-36">
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 h-px ${t === 0 ? "bg-stone-300" : "bg-stone-100"}`}
                  style={{ bottom: `${(t / max) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex items-end" onMouseLeave={() => onHover(null)}>
                {days.map((d) => {
                  const active = d.day === activeDay;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${title} ${fmtDay(d.day)} ${d.qty} ชิ้น`}
                      onClick={() => onSelect(d.day)}
                      onMouseEnter={() => onHover(d.day)}
                      className={`flex h-full min-w-0 flex-1 items-end justify-center rounded-md px-px outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                        active ? "bg-stone-100" : ""
                      }`}
                    >
                      <span
                        className={`w-full max-w-6 rounded-t ${barClass} ${active ? "" : "opacity-40"}`}
                        style={{ height: `${(d.qty / max) * 100}%`, minHeight: d.qty > 0 ? 2 : 0 }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-1.5 flex text-[11px] text-stone-400 tabular-nums">
              {days.map((d, i) => {
                const active = d.day === activeDay;
                return (
                  <span
                    key={d.day}
                    className={`min-w-0 flex-1 text-center whitespace-nowrap ${active ? "font-semibold text-stone-700" : ""}`}
                  >
                    {i % labelEvery === 0 ? dayjs(d.day).format("D") : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
