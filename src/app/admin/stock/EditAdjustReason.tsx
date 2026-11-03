"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { ADJUST_REASON_ICON, ADJUST_REASON_LABEL, type AdjustReason } from "@/lib/types";
import { updateAdjustmentReason } from "./actions";

const REASONS = Object.keys(ADJUST_REASON_LABEL) as AdjustReason[];

// ป้ายประเภทในตารางรายการตัด stock — กดเพื่อแก้ประเภทย้อนหลัง
export function EditAdjustReason({
  adjustmentId,
  reason,
  productName,
  qty,
  note,
}: {
  adjustmentId: number;
  reason: AdjustReason;
  productName: string;
  qty: number;
  note: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 transition hover:bg-red-200"
        aria-label={`แก้ประเภท ${ADJUST_REASON_LABEL[reason]}`}
        onClick={() => setOpen(true)}
      >
        {ADJUST_REASON_LABEL[reason]}
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        </svg>
      </button>
      {open && (
        <ReasonDialog
          adjustmentId={adjustmentId}
          reason={reason}
          productName={productName}
          qty={qty}
          note={note}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ReasonDialog({
  adjustmentId,
  reason,
  productName,
  qty,
  note,
  onClose,
}: {
  adjustmentId: number;
  reason: AdjustReason;
  productName: string;
  qty: number;
  note: string | null;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(reason);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await updateAdjustmentReason(adjustmentId, selected);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <Modal labelledBy={`reason-title-${adjustmentId}`} locked={pending} onClose={onClose}>
      <div>
        <h2 id={`reason-title-${adjustmentId}`} className="text-xl font-bold">
          แก้ประเภทรายการ
        </h2>
        <p className="text-sm text-stone-500">แก้เฉพาะประเภท จำนวน stock และต้นทุนไม่เปลี่ยน</p>
      </div>

      <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
        <div className="flex items-baseline justify-between gap-3 font-bold">
          <span>{productName}</span>
          <span className="shrink-0 tabular-nums">× {qty} ชิ้น</span>
        </div>
        {note && <p className="mt-1 wrap-break-word text-stone-700">{note}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={selected === r}
            className={`btn py-3 ${selected === r ? "bg-red-600 text-white" : "border border-stone-300 bg-white text-stone-700"}`}
            onClick={() => setSelected(r)}
          >
            <span aria-hidden>{ADJUST_REASON_ICON[r]}</span>
            {ADJUST_REASON_LABEL[r]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn-ghost rounded-2xl py-3" disabled={pending} onClick={onClose}>
          ยกเลิก
        </button>
        <button
          type="button"
          className="btn-success rounded-2xl py-3"
          disabled={pending || selected === reason}
          onClick={submit}
        >
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </Modal>
  );
}
