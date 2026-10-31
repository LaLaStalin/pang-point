import Link from "next/link";
import { notFound } from "next/navigation";
import { baht, fmtDateTime } from "@/lib/format";
import { getNameMaps } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_LABEL, PRICE_TYPE_LABEL, type Sale, type SaleItem } from "@/lib/types";
import { VoidSaleForm } from "./VoidSaleForm";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const saleId = Number(id);
  if (!Number.isInteger(saleId)) notFound();

  const supabase = await createClient();
  const [{ data: sale }, { data: items }, names] = await Promise.all([
    supabase.from("sales").select("*").eq("id", saleId).maybeSingle<Sale>(),
    supabase.from("sale_items").select("*").eq("sale_id", saleId).order("product_id"),
    getNameMaps(supabase),
  ]);
  if (!sale) notFound();

  const lines = (items ?? []) as SaleItem[];
  const cost = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);
  const profit = sale.total_amount - cost;
  const isVoid = sale.status === "void";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/admin/sales" className="text-sm text-amber-700 underline">
        ← กลับไปประวัติรายการ
      </Link>

      <section className="card">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">
              บิล #{sale.id} · ราคา{PRICE_TYPE_LABEL[sale.price_type]}
            </h1>
            <p className="text-sm text-stone-500">
              {fmtDateTime(sale.sold_at)} น. · ขายโดย {names.userName.get(sale.sold_by)}
            </p>
          </div>
          {isVoid && <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">ยกเลิกแล้ว</span>}
        </div>

        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between">
              <span>
                {names.productName.get(l.product_id)} {baht(l.unit_price)} บาท
                <span className="text-stone-500"> × {l.qty}</span>
              </span>
              <span>{baht(l.qty * l.unit_price)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-3">
          <div className="flex justify-between text-xl font-bold">
            <span>ยอดรวม {sale.total_qty} ชิ้น</span>
            <span>{baht(sale.total_amount)} ฿</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>รับเงิน ({PAYMENT_LABEL[sale.payment_method]})</span>
            <span>{baht(sale.received_amount)} ฿</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>ทอน</span>
            <span>{baht(sale.change_amount)} ฿</span>
          </div>
          <div className="flex justify-between pt-2 text-sm text-stone-500">
            <span>ต้นทุน {baht(Math.round(cost * 100) / 100)} ฿</span>
            <span>กำไร {baht(Math.round(profit * 100) / 100)} ฿</span>
          </div>
        </div>
      </section>

      {isVoid ? (
        <section className="card text-sm text-stone-600">
          ยกเลิกเมื่อ {fmtDateTime(sale.voided_at!)} โดย {names.userName.get(sale.voided_by!)}
          <br />
          เหตุผล: {sale.void_reason}
        </section>
      ) : (
        <VoidSaleForm saleId={sale.id} />
      )}
    </div>
  );
}
