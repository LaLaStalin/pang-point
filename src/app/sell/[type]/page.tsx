import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PriceType, Product } from "@/lib/types";
import { SellFlow } from "./SellFlow";

export default async function SellPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ cart?: string }>;
}) {
  const [{ type }, { cart }] = await Promise.all([params, searchParams]);
  if (type !== "retail" && type !== "wholesale") notFound();
  await requireProfile();

  const supabase = await createClient();
  const [{ data: products }, { data: settings }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("retail_price"),
    supabase.from("settings").select("promptpay_id").single(),
  ]);

  return (
    <SellFlow
      priceType={type as PriceType}
      products={(products ?? []) as Product[]}
      promptpayId={settings?.promptpay_id ?? null}
      initialQty={parseCart(cart)}
    />
  );
}

// ?cart=1:5,2:6 = รายการที่ยกมาจากบิลปลีก (product_id:จำนวน)
function parseCart(cart: string | undefined): Record<number, number> {
  const qty: Record<number, number> = {};
  for (const pair of cart?.split(",") ?? []) {
    const [id, n] = pair.split(":").map(Number);
    if (Number.isInteger(id) && Number.isInteger(n) && n > 0) qty[id] = Math.min(n, 9999);
  }
  return qty;
}
