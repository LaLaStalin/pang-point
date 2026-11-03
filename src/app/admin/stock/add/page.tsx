import { createClient } from "@/lib/supabase/server";
import type { ProductWithCost } from "@/lib/types";
import { AddStockForm } from "./AddStockForm";

export default async function AddStockPage() {
  const supabase = await createClient();
  const [{ data }, { data: supplierRows }] = await Promise.all([
    supabase.from("products_admin").select("*").eq("is_active", true).order("sort_order").order("retail_price"),
    // ร้านที่ซื้อล่าสุดขึ้นก่อน ที่เหลือเรียงตามชื่อ (เรียงมาจากฐานข้อมูล)
    supabase.rpc("active_suppliers_recent"),
  ]);
  const suppliers = ((supplierRows ?? []) as { name: string }[]).map((s) => s.name);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">เพิ่ม stock</h1>
      <p className="text-stone-600">
        เลือกร้านและราคาที่จะขาย แล้วกรอกต้นทุนต่อชิ้นกับจำนวน ถ้ากลุ่มเดียวกันมีหลายต้นทุนให้กด “+ เพิ่มต้นทุนอื่น” ระบบจะคิดต้นทุนเฉลี่ยให้เอง
      </p>
      <AddStockForm products={(data ?? []) as ProductWithCost[]} suppliers={suppliers} />
    </div>
  );
}
