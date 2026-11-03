import { redirect } from "next/navigation";
import { AdjustForm } from "@/components/AdjustForm";
import { AppHeader } from "@/components/AppHeader";
import { ShopNav } from "@/components/ShopNav";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { requestStockAdjustment } from "./actions";

export default async function ShopAdjustPage() {
  const profile = await requireProfile();
  // แอดมินตัดได้ทันทีไม่ต้องรออนุมัติ ใช้หน้าของแอดมิน
  if (profile.role === "admin") redirect("/admin/stock/adjust");

  const supabase = await createClient();
  // อ่านจาก products (ไม่มีต้นทุน) และไม่มีตารางรายการ — หน้าร้านดูประวัติไม่ได้
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("retail_price");

  return (
    <>
      <AppHeader profile={profile} />
      <ShopNav active="/adjust" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">ตัด stock: ของเสีย / ชิม</h1>
          <p className="text-stone-600">กดยืนยันแล้วจะส่งให้แอดมินตรวจสอบก่อน stock จะลดเมื่อแอดมินอนุมัติ</p>
        </div>
        <AdjustForm products={(products ?? []) as Product[]} action={requestStockAdjustment} requiresApproval />
      </main>
    </>
  );
}
