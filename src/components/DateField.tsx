"use client";

import { useState } from "react";

/**
 * ช่องเลือกวันที่ที่แสดงเป็น วว/ดด/ปปปป (พ.ศ.) เหมือนกันทุกเครื่อง
 * ใช้ input type="date" จริงแต่ซ่อนไว้ทับด้านบน กดแล้วจะเปิดปฏิทินของเครื่องตามปกติ
 * (iPad แสดง input date ตามภาษาเครื่อง เช่น "30 Oct BE 2569" และกว้างจนช่องซ้อนกัน)
 */
export function DateField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [y, m, d] = value.split("-");

  return (
    <div className="input relative flex w-44 items-center justify-between py-1.5 text-base">
      <span>{value ? `${d}/${m}/${Number(y) + 543}` : "เลือกวันที่"}</span>
      <svg viewBox="0 0 24 24" className="size-5 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <input
        type="date"
        name={name}
        value={value}
        required
        onChange={(e) => e.target.value && setValue(e.target.value)}
        // คอมต้องสั่งเปิดปฏิทินเอง (iPad/มือถือเปิดให้อัตโนมัติเมื่อแตะ)
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {}
        }}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      />
    </div>
  );
}
