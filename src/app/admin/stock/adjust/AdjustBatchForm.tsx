"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { QtyPicker } from "@/components/QtyPicker";
import { baht } from "@/lib/format";
import { ADJUST_REASON_ICON, ADJUST_REASON_LABEL, type AdjustReason, type ProductWithCost } from "@/lib/types";
import { adjustStockBatch } from "../actions";

const REASONS = Object.keys(ADJUST_REASON_LABEL) as AdjustReason[];

type Entry = { reason: AdjustReason; qty: string };
type Line = Entry & { product: ProductWithCost; qtyNum: number };

const DEFAULT_ENTRY: Entry = { reason: "damaged", qty: "" };
const roundBaht = (n: number) => Math.round(n * 100) / 100;

// แอดมินเลือกได้หลายสินค้า แต่ละสินค้ามีเหตุผลและจำนวนของตัวเอง ใช้หมายเหตุร่วมกันทั้งรอบ
export function AdjustBatchForm({ products }: { products: ProductWithCost[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lines: Line[] = products
    .filter((p) => selectedIds.includes(p.id))
    .map((p) => {
      const entry = entries[p.id] ?? DEFAULT_ENTRY;
      return { ...entry, product: p, qtyNum: Math.floor(Number(entry.qty)) };
    });
  const totalQty = lines.reduce((s, l) => s + l.qtyNum, 0);
  const missingQty = lines.some((l) => !(l.qtyNum > 0));
  const canReview = lines.length > 0 && !missingQty && note.trim().length > 0;

  function toggle(productId: number) {
    setSuccess(null);
    setSelectedIds((ids) => (ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]));
  }

  function patch(productId: number, change: Partial<Entry>) {
    setEntries((all) => ({ ...all, [productId]: { ...(all[productId] ?? DEFAULT_ENTRY), ...change } }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adjustStockBatch(
        lines.map((l) => ({ product_id: l.product.id, qty: l.qtyNum, reason: l.reason })),
        note,
      );
      if (res.ok) {
        setSuccess(`ตัด stock แล้ว ${lines.length} รายการ รวม ${totalQty} ชิ้น`);
        setSelectedIds([]);
        setEntries({});
        setNote("");
        setConfirming(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="card space-y-4">
      <div>
        <span className="label">สินค้า (เลือกได้หลายรายการ)</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {products.map((p) => {
            const selected = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(p.id)}
                className={`btn flex-col py-3 ${
                  selected ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700"
                }`}
              >
                <span>
                  {selected && "✓ "}
                  {p.name}
                </span>
                <span className="text-xs font-normal opacity-75">เหลือ {p.qty_on_hand}</span>
              </button>
            );
          })}
        </div>
      </div>

      {lines.map((l) => (
        <section key={l.product.id} className="space-y-3 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">{l.product.name}</h3>
            <button
              type="button"
              className="btn-ghost size-10 shrink-0 p-0 text-stone-500"
              onClick={() => toggle(l.product.id)}
              aria-label={`เอา ${l.product.name} ออก`}
            >
              ✕
            </button>
          </div>

          <div>
            <span className="label">เหตุผล</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={l.reason === r}
                  onClick={() => patch(l.product.id, { reason: r })}
                  className={`btn py-3 ${
                    l.reason === r ? "bg-red-600 text-white" : "border border-stone-300 bg-white text-stone-700"
                  }`}
                >
                  <span aria-hidden>{ADJUST_REASON_ICON[r]}</span>
                  {ADJUST_REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor={`adj-qty-${l.product.id}`}>
              จำนวนที่ตัดออก (ชิ้น)
            </label>
            <QtyPicker
              id={`adj-qty-${l.product.id}`}
              value={l.qty}
              onChange={(qty) => patch(l.product.id, { qty })}
            />
          </div>
        </section>
      ))}

      <div>
        <label className="label" htmlFor="adj-note">
          หมายเหตุ (ใช้กับทุกรายการในรอบนี้) <span className="text-red-600">*</span>
        </label>
        <textarea
          id="adj-note"
          className="input min-h-20"
          placeholder="เช่น เช็คของหมดอายุสิ้นวัน"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {success && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{success}</p>}
      {missingQty && <p className="text-sm text-stone-500">เลือกจำนวนให้ครบทุกรายการก่อนยืนยัน</p>}

      <button
        className="btn-danger w-full py-3 text-lg"
        disabled={!canReview}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {lines.length > 0 ? `ตรวจสอบและตัด stock (${lines.length} รายการ)` : "ตรวจสอบและตัด stock"}
      </button>

      {confirming && (
        <Modal labelledBy="batch-title" locked={pending} onClose={() => setConfirming(false)}>
          <div>
            <h2 id="batch-title" className="text-xl font-bold">
              ยืนยันตัด stock {lines.length} รายการ?
            </h2>
            <p className="text-sm text-stone-500">stock จะลดทันที และย้อนกลับไม่ได้</p>
          </div>

          <ul className="max-h-[45dvh] space-y-2 overflow-y-auto">
            {lines.map((l) => {
              const after = l.product.qty_on_hand - l.qtyNum;
              return (
                <li key={l.product.id} className="rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200/70">
                  <div className="flex items-baseline justify-between gap-3 font-bold">
                    <span>{l.product.name}</span>
                    <span className="shrink-0 tabular-nums">× {l.qtyNum} ชิ้น</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      <span aria-hidden>{ADJUST_REASON_ICON[l.reason]} </span>
                      {ADJUST_REASON_LABEL[l.reason]}
                    </span>
                    <span className="text-stone-500 tabular-nums">
                      เหลือ {l.product.qty_on_hand} → <b className={after < 0 ? "text-red-600" : "text-stone-800"}>{after}</b>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-stone-500">หมายเหตุ</dt>
              <dd className="text-right wrap-break-word">{note.trim()}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-500">รวม</dt>
              <dd className="font-semibold tabular-nums">{totalQty} ชิ้น</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-500">มูลค่าทุนประมาณ</dt>
              <dd className="font-semibold tabular-nums">
                {baht(roundBaht(lines.reduce((s, l) => s + l.qtyNum * l.product.avg_cost, 0)))} บาท
              </dd>
            </div>
          </dl>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-ghost rounded-2xl py-3" disabled={pending} onClick={() => setConfirming(false)}>
              ยกเลิก
            </button>
            <button type="button" className="btn-danger rounded-2xl py-3" disabled={pending} onClick={submit}>
              {pending ? "กำลังบันทึก..." : "ยืนยันตัด stock"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
