import Link from "next/link";
import { baht, fmtDate, fmtTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

type Purchase = {
  supplier: string | null;
  product_id: number;
  unit_cost: number;
  qty: number;
  note: string | null;
  created_at: string;
};

const NO_SUPPLIER = "(ไม่ระบุร้าน)";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s: selected } = await searchParams;

  const supabase = await createClient();
  const [{ data, error }, { data: products }] = await Promise.all([
    supabase
      .from("stock_purchases")
      .select("supplier, product_id, unit_cost, qty, note, created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .limit(5000),
    supabase.from("products").select("*"),
  ]);
  if (error) throw new Error(error.message);
  const purchases = ((data ?? []) as Purchase[]).map((p) => ({
    ...p,
    supplier: p.supplier ?? NO_SUPPLIER,
    unit_cost: Number(p.unit_cost),
  }));

  const productById = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const label = (id: number) => {
    const p = productById.get(id);
    if (!p) return `#${id}`;
    return p.kind === "tier" ? `${baht(p.wholesale_price)}/${baht(p.retail_price)}` : `อื่นๆ ${baht(p.retail_price)}`;
  };

  // สรุปรายร้าน (รายการเรียงจากล่าสุดอยู่แล้ว ร้านแรกที่เจอจึงเป็นร้านที่ซื้อล่าสุด)
  const summary = new Map<string, { rounds: Set<string>; qty: number; cost: number; last: string }>();
  for (const p of purchases) {
    const row = summary.get(p.supplier) ?? { rounds: new Set(), qty: 0, cost: 0, last: p.created_at };
    row.rounds.add(p.created_at);
    row.qty += p.qty;
    row.cost += p.qty * p.unit_cost;
    summary.set(p.supplier, row);
  }

  const mine = selected ? purchases.filter((p) => p.supplier === selected) : [];

  // แต่ละรอบการซื้อ = บรรทัดที่บันทึกพร้อมกัน (created_at เดียวกัน)
  const rounds = new Map<string, Purchase[]>();
  for (const p of mine) rounds.set(p.created_at, [...(rounds.get(p.created_at) ?? []), p]);

  // สรุปรายชนิดของร้านนี้: รวมกี่ชิ้น ทุนต่ำสุด/สูงสุด/เฉลี่ย
  const byProduct = new Map<number, { qty: number; cost: number; min: number; max: number }>();
  for (const p of mine) {
    const row = byProduct.get(p.product_id) ?? { qty: 0, cost: 0, min: Infinity, max: -Infinity };
    row.qty += p.qty;
    row.cost += p.qty * p.unit_cost;
    row.min = Math.min(row.min, p.unit_cost);
    row.max = Math.max(row.max, p.unit_cost);
    byProduct.set(p.product_id, row);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ร้านที่ซื้อ</h1>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ร้าน</th>
              <th className="text-right">ซื้อ (ครั้ง)</th>
              <th className="text-right">รวม (ชิ้น)</th>
              <th className="text-right">รวมเงิน</th>
              <th>ซื้อล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {[...summary].map(([name, row]) => (
              <tr key={name} className={name === selected ? "bg-amber-50" : undefined}>
                <td>
                  <Link href={`?s=${encodeURIComponent(name)}`} className="font-semibold text-amber-700 underline">
                    {name}
                  </Link>
                </td>
                <td className="text-right">{row.rounds.size}</td>
                <td className="text-right">{row.qty}</td>
                <td className="text-right font-semibold">{baht(row.cost)}</td>
                <td>{fmtDate(row.last)}</td>
              </tr>
            ))}
            {summary.size === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-stone-500">
                  ยังไม่มีประวัติการซื้อ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <h2 className="pt-2 text-xl font-bold">{selected}</h2>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ชนิด</th>
                  <th className="text-right">รวม (ชิ้น)</th>
                  <th className="text-right">ทุนต่ำสุด</th>
                  <th className="text-right">ทุนสูงสุด</th>
                  <th className="text-right">ทุนเฉลี่ย</th>
                  <th className="text-right">รวมเงิน</th>
                </tr>
              </thead>
              <tbody>
                {[...byProduct].map(([id, row]) => (
                  <tr key={id}>
                    <td className="font-semibold">{label(id)}</td>
                    <td className="text-right">{row.qty}</td>
                    <td className="text-right">{baht(row.min)}</td>
                    <td className="text-right">{baht(row.max)}</td>
                    <td className="text-right">{baht(Math.round((row.cost / row.qty) * 100) / 100)}</td>
                    <td className="text-right font-semibold">{baht(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[...rounds].map(([at, lines]) => (
              <section key={at} className="card">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-bold">{fmtDate(at)}</span>
                  <span className="text-sm text-stone-500">{fmtTime(at)} น.</span>
                </div>
                <ul className="space-y-1">
                  {lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        <b>{label(l.product_id)}</b> ต้นทุน {baht(l.unit_cost)} จำนวน {l.qty}
                      </span>
                      <span className="text-stone-600">{baht(l.qty * l.unit_cost)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between border-t border-dashed border-stone-300 pt-2 font-semibold">
                  <span>รวม {lines.reduce((s, l) => s + l.qty, 0)} ชิ้น</span>
                  <span>{baht(lines.reduce((s, l) => s + l.qty * l.unit_cost, 0))} ฿</span>
                </div>
                {lines[0].note && <p className="mt-1 text-sm text-stone-500">หมายเหตุ: {lines[0].note}</p>}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
