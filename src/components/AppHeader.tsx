import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { Profile } from "@/lib/types";

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-100 bg-white/90 shadow-[0_1px_12px_-4px_rgba(120,53,15,0.12)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="" width={32} height={32} unoptimized />
          <span className="hidden text-lg font-bold sm:inline">เจ๊แหม่มสับปะรด</span>
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {profile.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-full bg-amber-100 px-3.5 py-1.5 font-semibold text-amber-800 transition hover:bg-amber-200"
            >
              จัดการร้าน
            </Link>
          )}
          <span className="hidden items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-stone-600 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {profile.display_name}
          </span>
          <form action={logout}>
            <button className="rounded-full px-3 py-1.5 text-stone-500 transition hover:bg-red-50 hover:text-red-600">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
