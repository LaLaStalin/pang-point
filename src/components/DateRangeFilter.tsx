"use client";

import Form from "next/form";
import { usePathname } from "next/navigation";
import { DateField } from "./DateField";
import { TimeField } from "./TimeField";

/**
 * ฟอร์มเลือกช่วงวันที่ (GET) — ส่ง fromTime/toTime มาด้วยถ้าจะให้เลือกเวลาได้
 * ใช้ next/form เปลี่ยนหน้าแบบไม่โหลดใหม่ทั้งหน้า จะได้เห็น loading ระหว่างรอข้อมูล
 */
export function DateRangeFilter({
  from,
  to,
  fromTime,
  toTime,
  extra,
}: {
  from: string;
  to: string;
  fromTime?: string;
  toTime?: string;
  extra?: Record<string, string | undefined>;
}) {
  const pathname = usePathname();
  return (
    <Form action={pathname} className="flex flex-wrap items-end gap-2">
      {Object.entries(extra ?? {}).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <div>
        <span className="label">ตั้งแต่</span>
        <div className="flex gap-2">
          <DateField name="from" defaultValue={from} />
          {fromTime && <TimeField name="from_time" defaultValue={fromTime} />}
        </div>
      </div>
      <div>
        <span className="label">ถึง</span>
        <div className="flex gap-2">
          <DateField name="to" defaultValue={to} />
          {toTime && <TimeField name="to_time" defaultValue={toTime} />}
        </div>
      </div>
      <button className="btn-primary">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        ค้นหา
      </button>
    </Form>
  );
}
