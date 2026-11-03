"use client";

import { useState, useTransition } from "react";
import { QtyPicker } from "@/components/QtyPicker";
import { ADJUST_REASON_ICON, ADJUST_REASON_LABEL, type AdjustReason, type Product } from "@/lib/types";
import { requestStockAdjustment } from "./actions";

const REASONS = Object.keys(ADJUST_REASON_LABEL) as AdjustReason[];

// หน้าร้านส่งคำขอทีละรายการ ไม่เห็นมูลค่าทุน
export function AdjustForm({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<AdjustReason>("damaged");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const product = products.find((p) => p.id === productId);
  const qtyNum = Math.floor(Number(qty));
  const canSubmit = product && qtyNum > 0 && note.trim().length > 0;

  function submit() {
    if (!product) return;
    setMessage(null);
    startTransition(async () => {
      const res = await requestStockAdjustment({ product_id: product.id, qty: qtyNum, reason, note });
      if (res.ok) {
        setMessage({
          ok: true,
          text: `ส่งคำขอตัด ${product.name} ${qtyNum} ชิ้น (${ADJUST_REASON_LABEL[reason]}) แล้ว รอแอดมินอนุมัติ`,
        });
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
        <QtyPicker id="adj-qty" value={qty} onChange={setQty} />
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
        {pending ? "กำลังบันทึก..." : "ยืนยันส่งคำขอตัด stock"}
      </button>
    </div>
  );
}
