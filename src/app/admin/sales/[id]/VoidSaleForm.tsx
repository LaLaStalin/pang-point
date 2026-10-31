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
      <div className="flex justify-center">
        <button
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-lg font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.97]"
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="m15 9-6 6m0-6 6 6" strokeLinecap="round" />
          </svg>
          ยกเลิกบิลนี้
        </button>
      </div>
    );
  }

  return (
    <section className="card space-y-4 border-red-100">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 8v5m0 3.5v.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <div>
          <p className="font-semibold text-stone-900">ยกเลิกบิล #{saleId}?</p>
          <p className="text-sm text-stone-500">ของจะถูกคืนเข้า stock และไม่นับในยอดขาย</p>
        </div>
      </div>
      <textarea
        className="input min-h-20 text-base"
        placeholder="เหตุผล เช่น ลูกน้องกดจำนวนผิด"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn flex-1 rounded-full text-stone-600 hover:bg-stone-100"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          ไม่ยกเลิก
        </button>
        <button
          className="btn-danger flex-1 rounded-full"
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
