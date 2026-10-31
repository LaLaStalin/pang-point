import { LoadingSpinner } from "@/components/LoadingSpinner";

// แสดงระหว่างเปลี่ยนหน้าจากหน้าแรก (ไปหน้าขาย / จัดการร้าน) — ในหน้าจัดการร้านใช้ admin/loading.tsx แทน
export default function RootLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <LoadingSpinner />
    </div>
  );
}
