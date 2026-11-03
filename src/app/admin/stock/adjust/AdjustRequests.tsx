"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { baht, fmtDateTime } from "@/lib/format";
import { ADJUST_REASON_LABEL, type AdjustReason } from "@/lib/types";
import { reviewAdjustRequest } from "../actions";

export type AdjustRequest = {
  id: number;
  name: string;
  qty: number;
  qty_on_hand: number;
  avg_cost: number;
  reason: AdjustReason;
  note: string;
  created_at: string;
};

const estimatedCost = (r: AdjustRequest) => baht(Math.round(r.qty * r.avg_cost * 100) / 100);

export function AdjustRequests({ requests }: { requests: AdjustRequest[] }) {
  const [reviewing, setReviewing] = useState<{ request: AdjustRequest; approve: boolean } | null>(null);

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50/50">
          <div className="min-w-48 flex-1">
            <div className="font-bold">
              {r.name} × {r.qty} ชิ้น
              <span className="ml-2 text-sm font-medium text-red-700">{ADJUST_REASON_LABEL[r.reason]}</span>
            </div>
            <p className="text-stone-700">{r.note}</p>
            <p className="text-sm text-stone-500">
              {fmtDateTime(r.created_at)} · เหลือ {r.qty_on_hand} ชิ้น · มูลค่าทุนประมาณ {estimatedCost(r)} บาท
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setReviewing({ request: r, approve: false })}>
              ไม่อนุมัติ
            </button>
            <button className="btn-success" onClick={() => setReviewing({ request: r, approve: true })}>
              อนุมัติ
            </button>
          </div>
        </div>
      ))}

      {reviewing && (
        <ReviewDialog
          key={reviewing.request.id}
          request={reviewing.request}
          approve={reviewing.approve}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

function ReviewDialog({
  request: r,
  approve,
  onClose,
}: {
  request: AdjustRequest;
  approve: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const after = r.qty_on_hand - r.qty;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await reviewAdjustRequest(r.id, approve);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <Modal labelledBy="review-title" locked={pending} onClose={onClose}>
      <div className="flex items-center gap-4">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
            approve ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {approve ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6 6 18" />}
          </svg>
        </span>
        <div>
          <h2 id="review-title" className="text-xl font-bold">
            {approve ? "อนุมัติและตัด stock?" : "ไม่อนุมัติคำขอนี้?"}
          </h2>
          <p className="text-sm text-stone-500">
            {approve ? "stock จะลดทันทีและย้อนกลับไม่ได้" : "stock จะไม่เปลี่ยนแปลง"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-bold">{r.name}</span>
          <span className="shrink-0 text-lg font-bold tabular-nums">× {r.qty} ชิ้น</span>
        </div>
        <span className="mt-1 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          {ADJUST_REASON_LABEL[r.reason]}
        </span>
        <p className="mt-2 wrap-break-word text-stone-700">{r.note}</p>
        <p className="mt-1 text-sm text-stone-400">ขอเมื่อ {fmtDateTime(r.created_at)}</p>

        <dl className="mt-3 space-y-1.5 border-t border-dashed border-stone-300 pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">{approve ? "คงเหลือหลังตัด" : "คงเหลือ"}</dt>
            <dd className="font-semibold tabular-nums">
              {approve ? (
                <>
                  <span className="font-normal text-stone-400">{r.qty_on_hand} → </span>
                  <span className={after < 0 ? "text-red-600" : ""}>{after} ชิ้น</span>
                </>
              ) : (
                `${r.qty_on_hand} ชิ้น`
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">มูลค่าทุนประมาณ</dt>
            <dd className="font-semibold tabular-nums">{estimatedCost(r)} บาท</dd>
          </div>
        </dl>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost rounded-2xl py-3" disabled={pending} onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className={`${approve ? "btn-success" : "btn-danger"} rounded-2xl py-3`}
          disabled={pending}
          onClick={submit}
        >
          {pending ? "กำลังบันทึก..." : approve ? "อนุมัติ" : "ไม่อนุมัติ"}
        </button>
      </div>
    </Modal>
  );
}
