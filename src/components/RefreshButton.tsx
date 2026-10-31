"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// ปุ่มดึงข้อมูลหน้านี้ใหม่ — แอปบนหน้าจอหลักไม่มีปุ่มรีโหลดของเบราว์เซอร์
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-busy={pending}
      className="btn-ghost shrink-0 gap-1.5 px-3 py-1.5 text-sm disabled:opacity-100"
    >
      {/* ไอคอนหมุนระหว่างโหลด — ข้อความคงเดิม ปุ่มจะได้ไม่ยืดหด */}
      <svg
        viewBox="0 0 24 24"
        className={`size-4 text-stone-900${pending ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      รีเฟรช
    </button>
  );
}
