"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                active ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
