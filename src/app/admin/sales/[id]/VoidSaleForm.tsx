"use client";

import { useState, useTransition } from "react";
import { voidSale } from "../actions";

export function VoidSaleForm({ saleId }: { saleId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="btn-ghost w-full text-red-600" onClick={() => setOpen(true)}>
        ยกเลิกบิลนี้
      </button>
    );
  }

  return (
    <section className="card space-y-3 border-red-200">
      <p className="font-semibold text-red-700">ยกเลิกบิล #{saleId} — ของจะถูกคืนเข้า stock และไม่นับในยอดขาย</p>
      <textarea
        className="input min-h-20"
        placeholder="เหตุผล เช่น ลูกน้องกดจำนวนผิด"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={pending}>
          ไม่ยกเลิก
        </button>
        <button
          className="btn-danger flex-1"
          disabled={!reason.trim() || pending}
          onClick={() =>
            startTransition(async () => {
              const res = await voidSale(saleId, reason);
              if (!res.ok) setError(res.error);
            })
          }
        >
          {pending ? "กำลังยกเลิก..." : "ยืนยันยกเลิกบิล"}
        </button>
      </div>
    </section>
  );
}
