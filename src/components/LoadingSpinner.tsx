/** วงกลมหมุน + "กำลังโหลด…" — ใช้ทุกที่ที่ต้องรอหน้าโหลด ให้หน้าตาเหมือนกันหมด */
export function LoadingSpinner() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-lg ring-1 ring-stone-200"
      role="status"
      aria-label="กำลังโหลด"
    >
      <div className="size-12 animate-spin rounded-full border-[5px] border-amber-200 border-t-amber-500" />
      <p className="text-lg font-semibold text-stone-700">กำลังโหลด…</p>
    </div>
  );
}
