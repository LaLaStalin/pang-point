"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const LINKS = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/stock", label: "เช็ค stock" },
  { href: "/admin/stock/add", label: "เพิ่ม stock" },
  { href: "/admin/stock/adjust", label: "ตัดของเสีย/ชิม" },
  { href: "/admin/stock/history", label: "ประวัติ stock" },
  { href: "/admin/stock/suppliers", label: "ร้านที่ซื้อ" },
  { href: "/admin/sales", label: "ประวัติรายการ" },
  { href: "/admin/reports", label: "รายงานกำไร" },
  { href: "/admin/settings", label: "ตั้งค่า" },
  { href: "/admin/accounts", label: "รหัสผ่าน" },
];

export function AdminNav() {
  const pathname = usePathname();
  // เมนูที่เพิ่งกด — ไฮไลต์ทันทีไม่ต้องรอหน้าโหลดเสร็จ (ใช้ได้เฉพาะตอนยังอยู่หน้าเดิมที่กด)
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const current = clicked?.from === pathname ? clicked.href : pathname;

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
        {LINKS.map((l) => {
          const active = current === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => l.href !== pathname && setClicked({ href: l.href, from: pathname })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                active ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {l.label}
              <PendingIndicator />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ระหว่างรอหน้าโหลด: จุดกระพริบข้างเมนูที่กด + ทำหน้าจาง มีวงกลมหมุนกลางจอ — ให้รู้ว่ากดติดแล้ว ต้องรอแป๊บ
function PendingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white/80 align-middle" />
      <span className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-amber-50/60">
        <LoadingSpinner />
      </span>
    </>
  );
}
