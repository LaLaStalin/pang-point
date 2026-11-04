import { createClient } from "@/lib/supabase/server";
import { QR_IMAGE_BUCKET, type Product } from "@/lib/types";
import {
  AddTierProductForm,
  OtherProductsForm,
  QrSettingsForm,
  SuppliersForm,
  TierProductForm,
  type Supplier,
} from "./SettingsForms";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: settings }, { data: suppliers }] = await Promise.all([
    supabase.from("products").select("*").order("sort_order").order("retail_price"),
    supabase.from("settings").select("qr_method, promptpay_id, qr_image_path").single(),
    supabase.from("suppliers").select("id, name, is_active").order("name"),
  ]);
  const all = (products ?? []) as Product[];
  const tiers = all.filter((p) => p.kind === "tier");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">ราคาขนม (ปลีก / ส่ง)</h2>
        {tiers
          .filter((p) => p.is_active)
          .map((p) => (
            <TierProductForm key={p.id} product={p} />
          ))}
        <AddTierProductForm hidden={tiers.filter((p) => !p.is_active)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">ราคา “อื่นๆ” (ราคาเต็ม นับ stock แยกตามราคา)</h2>
        <OtherProductsForm products={all.filter((p) => p.kind === "other")} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">ร้านที่ซื้อของ</h2>
        <SuppliersForm suppliers={(suppliers ?? []) as Supplier[]} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">QR รับเงิน</h2>
        <QrSettingsForm
          initial={{
            method: settings?.qr_method === "image" ? "image" : "promptpay",
            promptpayId: settings?.promptpay_id ?? "",
            imagePath: settings?.qr_image_path ?? null,
            imageUrl: settings?.qr_image_path
              ? supabase.storage.from(QR_IMAGE_BUCKET).getPublicUrl(settings.qr_image_path).data.publicUrl
              : null,
          }}
        />
      </section>
    </div>
  );
}
