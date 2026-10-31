import Link from "next/link";
import { baht, fmtDate, fmtTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

type Purchase = {
  product_id: number;
  unit_cost: number;
  qty: number;
  note: string | null;
  created_at: string;
};

type SupplierRow = { supplier: string | null; rounds: number; qty: number; cost: number; last_at: string };
type ProductRow = { product_id: number; qty: number; cost: number; min_cost: number; max_cost: number };

const NO_SUPPLIER = "(ไม่ระบุร้าน)";
// รายการรอบการซื้อของร้านที่เลือก ดึงเฉพาะล่าสุด (ยอดรวมด้านบนคิดจากทั้งหมดในฐานข้อมูล)
const ROUND_LINES = 300;

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s: selected } = await searchParams;
  // ชื่อ "(ไม่ระบุร้าน)" ในหน้าเว็บ = supplier เป็น null ในฐานข้อมูล
  const supplierParam = selected === NO_SUPPLIER ? null : (selected ?? null);

  const supabase = await createClient();
  let roundsQuery = supabase
    .from("stock_purchases")
    .select("product_id, unit_cost, qty, note, created_at")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(ROUND_LINES);
  roundsQuery = supplierParam === null ? roundsQuery.is("supplier", null) : roundsQuery.eq("supplier", supplierParam);

  const [{ data, error }, { data: products }, byProductRes, roundsRes] = await Promise.all([
    supabase.rpc("supplier_summary"),
    supabase.from("products").select("*"),
    selected ? supabase.rpc("supplier_product_summary", { p_supplier: supplierParam }) : null,
    selected ? roundsQuery : null,
  ]);
  if (error) throw new Error(error.message);
  if (byProductRes?.error) throw new Error(byProductRes.error.message);
  if (roundsRes?.error) throw new Error(roundsRes.error.message);

  const summary = ((data ?? []) as SupplierRow[]).map((r) => ({
    ...r,
    supplier: r.supplier ?? NO_SUPPLIER,
    cost: Number(r.cost),
  }));
  const byProduct = ((byProductRes?.data ?? []) as ProductRow[]).map((r) => ({
    ...r,
    cost: Number(r.cost),
    min_cost: Number(r.min_cost),
    max_cost: Number(r.max_cost),
  }));
  const purchases = ((roundsRes?.data ?? []) as Purchase[]).map((p) => ({ ...p, unit_cost: Number(p.unit_cost) }));

  const productById = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const label = (id: number) => {
    const p = productById.get(id);
    if (!p) return `#${id}`;
    return p.kind === "tier" ? `${baht(p.wholesale_price)}/${baht(p.retail_price)}` : `อื่นๆ ${baht(p.retail_price)}`;
  };

  // แต่ละรอบการซื้อ = บรรทัดที่บันทึกพร้อมกัน (created_at เดียวกัน)
  const rounds = new Map<string, Purchase[]>();
  for (const p of purchases) rounds.set(p.created_at, [...(rounds.get(p.created_at) ?? []), p]);
  // ดึงมาครบเพดาน = รอบสุดท้ายอาจได้มาไม่ครบทุกบรรทัด ตัดทิ้งไป
  const truncated = purchases.length === ROUND_LINES;
  if (truncated && rounds.size > 1) rounds.delete([...rounds.keys()].at(-1)!);

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
            {summary.map((row) => (
              <tr key={row.supplier} className={row.supplier === selected ? "bg-amber-50" : undefined}>
                <td>
                  <Link
                    href={`?s=${encodeURIComponent(row.supplier)}`}
                    className="font-semibold text-amber-500 underline hover:text-amber-600"
                  >
                    {row.supplier}
                  </Link>
                </td>
                <td className="text-right">{row.rounds}</td>
                <td className="text-right">{row.qty}</td>
                <td className="text-right font-semibold">{baht(row.cost)}</td>
                <td>{fmtDate(row.last_at)}</td>
              </tr>
            ))}
            {summary.length === 0 && (
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
                {byProduct.map((row) => (
                  <tr key={row.product_id}>
                    <td className="font-semibold">{label(row.product_id)}</td>
                    <td className="text-right">{row.qty}</td>
                    <td className="text-right">{baht(row.min_cost)}</td>
                    <td className="text-right">{baht(row.max_cost)}</td>
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
          {truncated && <p className="text-sm text-stone-500">แสดงเฉพาะรอบการซื้อล่าสุด</p>}
        </>
      )}
    </div>
  );
}
