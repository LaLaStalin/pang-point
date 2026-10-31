import { createClient } from "@/lib/supabase/server";
import type { ProductWithCost } from "@/lib/types";
import { AddStockForm } from "./AddStockForm";

export default async function AddStockPage() {
  const supabase = await createClient();
  const [{ data }, { data: supplierRows }, { data: purchases }] = await Promise.all([
    supabase.from("products_admin").select("*").eq("is_active", true).order("sort_order").order("retail_price"),
    supabase.from("suppliers").select("name").eq("is_active", true).order("name"),
    supabase
      .from("stock_purchases")
      .select("supplier")
      .not("supplier", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  // ร้านที่ซื้อล่าสุดขึ้นก่อน ที่เหลือเรียงตามชื่อ
  const active = new Set((supplierRows ?? []).map((s) => s.name as string));
  const recent = [...new Set((purchases ?? []).map((p) => p.supplier as string))].filter((n) => active.has(n));
  const suppliers = [...new Set([...recent, ...active])];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">เพิ่ม stock</h1>
      <p className="text-stone-600">
        กรอกต้นทุนต่อชิ้นและจำนวนที่ซื้อมา ถ้ากลุ่มเดียวกันมีหลายต้นทุนให้กด “+ เพิ่มต้นทุนอื่น” ระบบจะคิดต้นทุนเฉลี่ยให้เอง
      </p>
      <AddStockForm products={(data ?? []) as ProductWithCost[]} suppliers={suppliers} />
    </div>
  );
}
