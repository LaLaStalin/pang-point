import { AppHeader } from "@/components/AppHeader";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <>
      <AppHeader profile={profile} />
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </>
  );
}
