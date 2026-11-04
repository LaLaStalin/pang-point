import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QR_IMAGE_BUCKET, type PriceType, type Product } from "@/lib/types";
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
    supabase.from("settings").select("qr_method, promptpay_id, qr_image_path").single(),
  ]);
  // ส่งเฉพาะข้อมูลของแบบที่แอดมินเลือก
  const isImage = settings?.qr_method === "image" && settings.qr_image_path;

  return (
    <SellFlow
      priceType={type as PriceType}
      products={(products ?? []) as Product[]}
      promptpayId={isImage ? null : (settings?.promptpay_id ?? null)}
      qrImageUrl={
        isImage ? supabase.storage.from(QR_IMAGE_BUCKET).getPublicUrl(settings.qr_image_path).data.publicUrl : null
      }
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
