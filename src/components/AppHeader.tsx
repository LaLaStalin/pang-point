import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { Profile } from "@/lib/types";

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-20 border-b border-amber-200 bg-amber-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Image src="/icon.svg" alt="" width={32} height={32} unoptimized />
          <span className="hidden sm:inline">เจ๊แหม่มสับปะรด</span>
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {profile.role === "admin" && (
            <Link href="/admin" className="btn-ghost px-3 py-1.5">
              จัดการร้าน
            </Link>
          )}
          <span className="text-stone-600">{profile.display_name}</span>
          <form action={logout}>
            <button className="btn px-2 py-1.5 text-stone-500 hover:text-stone-800">ออกจากระบบ</button>
          </form>
        </div>
      </div>
    </header>
  );
}
