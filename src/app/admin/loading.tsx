import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function AdminLoading() {
  return (
    <div className="relative" aria-busy="true">
      {/* โครงหน้าจาง ๆ ด้านหลัง + วงกลมหมุนตรงกลาง ให้เห็นชัดบนมือถือ/แท็บเล็ต */}
      <div className="animate-pulse space-y-4" aria-hidden>
        <div className="h-8 w-48 rounded-lg bg-stone-200" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-stone-200" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-stone-200" />
      </div>
      <div className="absolute inset-x-0 top-16 flex justify-center">
        <LoadingSpinner />
      </div>
    </div>
  );
}
