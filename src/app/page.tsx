import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { requireProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await requireProfile();

  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto flex max-w-3xl flex-col px-4 py-6">
        <h1 className="mb-1 text-center text-2xl font-bold">เจ๊แหม่มสับปะรด</h1>
        <p className="mb-8 text-center text-stone-500">เลือกราคาของบิลนี้</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/sell/retail"
            className="flex aspect-[2/1] flex-col items-center justify-center rounded-3xl bg-amber-500 text-white shadow-lg transition active:scale-[0.97] sm:aspect-square"
          >
            <span className="text-6xl font-bold">ปลีก</span>
            <span className="mt-2 text-lg opacity-90">ขายลูกค้าทั่วไป</span>
          </Link>
          <Link
            href="/sell/wholesale"
            className="flex aspect-[2/1] flex-col items-center justify-center rounded-3xl bg-sky-600 text-white shadow-lg transition active:scale-[0.97] sm:aspect-square"
          >
            <span className="text-6xl font-bold">ส่ง</span>
            <span className="mt-2 text-lg opacity-90">ขายราคาส่ง</span>
          </Link>
        </div>
      </main>
    </>
  );
}
