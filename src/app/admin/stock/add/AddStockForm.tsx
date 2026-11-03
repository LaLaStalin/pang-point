"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { baht } from "@/lib/format";
import type { ProductWithCost } from "@/lib/types";
import { addStock } from "../actions";

type Line = { key: number; cost: string; qty: string };

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, cost: "", qty: "" });

export function AddStockForm({ products, suppliers }: { products: ProductWithCost[]; suppliers: string[] }) {
  const [lines, setLines] = useState<Record<number, Line[]>>(() =>
    Object.fromEntries(products.map((p) => [p.id, [emptyLine()]])),
  );
  // ราคาที่จะกรอกรอบนี้ — ยกเลิกแล้วค่าที่กรอกยังเก็บอยู่ใน lines แต่ไม่ถูกนำไปบันทึก
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [supplier, setSupplier] = useState("");
  const [typingNew, setTypingNew] = useState(suppliers.length === 0);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = (l: Line) => l.qty !== "" && Number(l.qty) > 0 && l.cost !== "" && Number(l.cost) >= 0;
  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
  const payload = selectedProducts.flatMap((p) =>
    (lines[p.id] ?? []).filter(valid).map((l) => ({
      product_id: p.id,
      unit_cost: Number(l.cost),
      qty: Math.floor(Number(l.qty)),
    })),
  );
  const grandQty = payload.reduce((s, l) => s + l.qty, 0);
  const grandCost = payload.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  function togglePrice(productId: number) {
    setSelectedIds((ids) => (ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]));
  }

  function update(productId: number, key: number, patch: Partial<Line>) {
    setLines((all) => ({
      ...all,
      [productId]: all[productId].map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  }

  function addLine(productId: number) {
    setLines((all) => ({ ...all, [productId]: [...all[productId], emptyLine()] }));
  }

  function removeLine(productId: number, key: number) {
    setLines((all) => {
      const rest = all[productId].filter((l) => l.key !== key);
      return { ...all, [productId]: rest.length ? rest : [emptyLine()] };
    });
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await addStock(payload, supplier, note);
      if (res.ok) {
        setMessage({ ok: true, text: `บันทึกแล้ว (${supplier.trim()}) ${grandQty} ชิ้น ต้นทุนรวม ${baht(grandCost)} บาท` });
        setLines(Object.fromEntries(products.map((p) => [p.id, [emptyLine()]])));
        setSelectedIds([]);
        setSupplier("");
        setTypingNew(false);
        setNote("");
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="card space-y-3">
        <div className="label">
          ชื่อร้าน <span className="text-red-600">*</span>
        </div>
        {/* เลือกจากรายการ จะได้สะกดตรงกันทุกครั้ง ประวัติแยกร้านจะไม่แตกเป็นหลายชื่อ */}
        <div className="flex flex-wrap gap-2">
          {suppliers.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn px-4 py-2 ${!typingNew && supplier === s ? "bg-amber-500 text-white" : "bg-white text-stone-700 ring-1 ring-stone-300"}`}
              onClick={() => {
                setSupplier(s);
                setTypingNew(false);
              }}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            className={`btn px-4 py-2 ${typingNew ? "bg-stone-800 text-white" : "border border-dashed border-stone-400 bg-white text-stone-700"}`}
            onClick={() => {
              setSupplier("");
              setTypingNew(true);
            }}
          >
            + ร้านใหม่
          </button>
        </div>
        {typingNew && (
          <div>
            <input
              className="input text-lg"
              placeholder="พิมพ์ชื่อร้านใหม่ เช่น ร้านจิน"
              autoComplete="off"
              autoFocus={suppliers.length > 0}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <p className="mt-1 text-sm text-stone-500">บันทึกแล้วร้านนี้จะเข้ารายการให้เลือกครั้งหน้าอัตโนมัติ</p>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <div className="label">ขายราคาไหนบ้าง? (เลือกได้หลายราคา)</div>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={selectedIds.includes(p.id)}
              className={`btn px-4 py-2 ${selectedIds.includes(p.id) ? "bg-amber-500 text-white" : "bg-white text-stone-700 ring-1 ring-stone-300"}`}
              onClick={() => togglePrice(p.id)}
            >
              {p.kind === "tier" ? `${p.name} ${baht(p.wholesale_price)}/${baht(p.retail_price)}` : p.name}
            </button>
          ))}
        </div>
      </div>

      {selectedProducts.map((p) => {
        const valids = (lines[p.id] ?? []).filter(valid);
        const addQty = valids.reduce((s, l) => s + Number(l.qty), 0);
        const addCost = valids.reduce((s, l) => s + Number(l.qty) * Number(l.cost), 0);
        const base = Math.max(0, p.qty_on_hand);
        const newAvg =
          addQty > 0 ? (p.qty_on_hand <= 0 ? addCost / addQty : (base * p.avg_cost + addCost) / (base + addQty)) : null;

        return (
          <section key={p.id} className="card">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-bold">
                {p.kind === "tier" ? `${baht(p.wholesale_price)}/${baht(p.retail_price)}` : `${baht(p.retail_price)} บาท`}
              </h2>
              <span className="text-stone-600">{p.name}</span>
              <span className="ml-auto text-sm text-stone-500">
                มีอยู่ {p.qty_on_hand} ชิ้น · ทุนเฉลี่ย {baht(p.avg_cost)}
              </span>
            </div>

            <div className="space-y-2">
              {(lines[p.id] ?? []).map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <label className="flex flex-1 items-center gap-2">
                    <span className="shrink-0 text-sm text-stone-500">ต้นทุน</span>
                    <input
                      className="input min-w-0"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="บาท/ชิ้น"
                      value={l.cost}
                      onChange={(e) => update(p.id, l.key, { cost: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-1 items-center gap-2">
                    <span className="shrink-0 text-sm text-stone-500">จำนวน</span>
                    <input
                      className="input min-w-0"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="ชิ้น"
                      value={l.qty}
                      onChange={(e) => update(p.id, l.key, { qty: e.target.value })}
                    />
                  </label>
                  <button
                    className="btn-ghost size-11 shrink-0 p-0 text-stone-500"
                    onClick={() => removeLine(p.id, l.key)}
                    aria-label="ลบบรรทัด"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => addLine(p.id)}>
                + เพิ่มต้นทุนอื่น
              </button>
              {addQty > 0 && (
                <span className="ml-auto text-right text-sm">
                  <b>รวม {addQty} ชิ้น</b> · ทุน {baht(addCost)} ฿
                  <br />
                  <span className="text-stone-500">ทุนเฉลี่ยใหม่ ≈ {baht(Math.round(newAvg! * 100) / 100)} บาท/ชิ้น</span>
                </span>
              )}
            </div>
          </section>
        );
      })}

      <p className="text-sm text-stone-500">
        ต้องการราคา “อื่นๆ” ใหม่? เพิ่มได้ที่{" "}
        <Link href="/admin/settings" className="text-amber-700 underline">
          ตั้งค่า
        </Link>
      </p>

      <div className="card">
        <label className="label" htmlFor="note">
          หมายเหตุ (ไม่บังคับ)
        </label>
        <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {message && (
        <p className={`rounded-lg p-3 ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="text-sm text-stone-500">{supplier.trim() || "ยังไม่ใส่ชื่อร้าน"}</div>
            <div className="text-xl font-bold">
              {grandQty} ชิ้น · {baht(grandCost)} ฿
            </div>
          </div>
          <button className="btn-success px-8 py-3 text-lg" disabled={grandQty === 0 || supplier.trim() === "" || pending} onClick={submit}>
            {pending ? "กำลังบันทึก..." : "บันทึก stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
