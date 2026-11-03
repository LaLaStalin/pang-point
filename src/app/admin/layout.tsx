import { AppHeader } from "@/components/AppHeader";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  // จำนวนคำขอตัด stock ที่รออนุมัติ แสดงเป็นป้ายบนเมนู
  const { count } = await supabase
    .from("stock_adjustment_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <>
      <AppHeader profile={profile} />
      <AdminNav pendingAdjustRequests={count ?? 0} />
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </>
  );
}
