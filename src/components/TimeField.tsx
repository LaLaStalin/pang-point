"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * ช่องเลือกเวลาแบบไทย: [ชั่วโมง] : [นาที] น. (24 ชม.)
 * ไม่ใช้ input type="time" เพราะตัวเลือกเวลาของเครื่องเป็นภาษา/AM-PM ตามเครื่อง เปลี่ยนจากเว็บไม่ได้
 * ส่งค่าในฟอร์มเป็น HH:mm ผ่าน hidden input
 */
export function TimeField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [hour, setHour] = useState(defaultValue.slice(0, 2));
  const [minute, setMinute] = useState(defaultValue.slice(3, 5));
  const selectCls = "cursor-pointer appearance-none bg-transparent px-1 text-center outline-none";

  return (
    <div className="input flex w-auto items-center gap-0.5 py-1.5 text-base">
      <input type="hidden" name={name} value={`${hour}:${minute}`} />
      <select aria-label="ชั่วโมง" value={hour} onChange={(e) => setHour(e.target.value)} className={selectCls}>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span>:</span>
      <select aria-label="นาที" value={minute} onChange={(e) => setMinute(e.target.value)} className={selectCls}>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <span className="ml-1 text-stone-500">น.</span>
    </div>
  );
}
