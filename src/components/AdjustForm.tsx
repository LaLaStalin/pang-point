"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/stock/actions";
import { baht } from "@/lib/format";
import { ADJUST_REASON_ICON, ADJUST_REASON_LABEL, type AdjustReason, type Product } from "@/lib/types";

const REASONS = Object.keys(ADJUST_REASON_LABEL) as AdjustReason[];
const QUICK_QTY = [1, 2, 3, 4, 5, 10];

// ใช้ทั้งแอดมินและหน้าร้าน — avg_cost มีเฉพาะฝั่งแอดมิน หน้าร้านจึงไม่เห็นมูลค่าทุน
export function AdjustForm({
  products,
  action,
  requiresApproval = false,
}: {
  products: (Product & { avg_cost?: number })[];
  action: (input: { product_id: number; qty: number; reason: AdjustReason; note: string }) => Promise<ActionResult>;
  requiresApproval?: boolean;
}) {
  const [productId, setProductId] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<AdjustReason>("damaged");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const product = products.find((p) => p.id === productId);
  const qtyNum = Math.floor(Number(qty));
  const canSubmit = product && qtyNum > 0 && note.trim().length > 0;

  function stepQty(delta: number) {
    setQty(String(Math.max(0, qtyNum + delta) || ""));
  }

  function submit() {
    if (!product) return;
    setMessage(null);
    startTransition(async () => {
      const res = await action({ product_id: product.id, qty: qtyNum, reason, note });
      if (res.ok) {
        const item = `${product.name} ${qtyNum} ชิ้น (${ADJUST_REASON_LABEL[reason]})`;
        setMessage({ ok: true, text: requiresApproval ? `ส่งคำขอตัด ${item} แล้ว รอแอดมินอนุมัติ` : `ตัด ${item} แล้ว` });
        setQty("");
        setNote("");
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="card space-y-4">
      <div>
        <span className="label">สินค้า</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setProductId(p.id)}
              className={`btn flex-col py-3 ${
                productId === p.id ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700"
              }`}
            >
              <span>{p.name}</span>
              <span className="text-xs font-normal opacity-75">เหลือ {p.qty_on_hand}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">เหตุผล</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`btn py-3 ${
                reason === r ? "bg-red-600 text-white" : "border border-stone-300 bg-white text-stone-700"
              }`}
            >
              <span aria-hidden>{ADJUST_REASON_ICON[r]}</span>
              {ADJUST_REASON_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="adj-qty">
          จำนวนที่ตัดออก (ชิ้น)
        </label>
        <div className="grid grid-cols-6 gap-2">
          {QUICK_QTY.map((n) => (
            <button
              key={n}
              aria-pressed={qtyNum === n}
              onClick={() => setQty(String(n))}
              className={`btn px-0 py-3 text-lg ${
                qtyNum === n ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {/* จำนวนอื่นที่ไม่มีปุ่ม: กด − / + หรือพิมพ์เองได้ */}
        <div className="mt-2 flex items-center gap-2">
          <button className="btn-ghost size-12 shrink-0 p-0 text-2xl" onClick={() => stepQty(-1)} aria-label="ลดจำนวน">
            −
          </button>
          <input
            id="adj-qty"
            className="input h-12 min-w-0 flex-1 text-center font-bold"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <button className="btn-ghost size-12 shrink-0 p-0 text-2xl" onClick={() => stepQty(1)} aria-label="เพิ่มจำนวน">
            +
          </button>
        </div>
        {product?.avg_cost != null && qtyNum > 0 && (
          <p className="mt-1 text-sm text-stone-500">
            มูลค่าทุนประมาณ {baht(Math.round(qtyNum * product.avg_cost * 100) / 100)} บาท
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="adj-note">
          หมายเหตุ <span className="text-red-600">*</span>
        </label>
        <textarea
          id="adj-note"
          className="input min-h-20"
          placeholder="เช่น ขนมปังขึ้นรา 3 ชิ้น / ลูกน้องชิมรสใหม่"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {message && (
        <p className={`rounded-lg p-3 ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}

      <button className="btn-danger w-full py-3 text-lg" disabled={!canSubmit || pending} onClick={submit}>
        {pending ? "กำลังบันทึก..." : requiresApproval ? "ยืนยันส่งคำขอตัด stock" : "ยืนยันตัด stock"}
      </button>
    </div>
  );
}
