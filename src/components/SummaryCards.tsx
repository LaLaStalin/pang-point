import { baht } from "@/lib/format";
import { ADJUST_REASON_LABEL, type SalesSummary } from "@/lib/types";

export function SummaryCards({ summary }: { summary: SalesSummary }) {
  const profit = summary.revenue - summary.cost;
  const lossTotal = summary.losses.reduce((s, l) => s + Number(l.cost), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ยอดขาย" value={`${baht(summary.revenue)} ฿`} sub={`${summary.bill_count} บิล · ${summary.total_qty} ชิ้น`} />
        <Stat label="ต้นทุนของที่ขาย" value={`${baht(summary.cost)} ฿`} />
        <Stat label="กำไรขั้นต้น" value={`${baht(profit)} ฿`} tone={profit >= 0 ? "good" : "bad"} />
        <Stat
          label="ของเสีย/ชิม (มูลค่าทุน)"
          value={`${baht(lossTotal)} ฿`}
          sub={summary.losses.map((l) => `${ADJUST_REASON_LABEL[l.reason]} ${l.qty}`).join(" · ") || "—"}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="เงินสด" value={`${baht(summary.cash_amount)} ฿`} small />
        <Stat label="พร้อมเพย์" value={`${baht(summary.promptpay_amount)} ฿`} small />
        <Stat label="บิลปลีก" value={`${baht(summary.retail_amount)} ฿`} small />
        <Stat label="บิลส่ง" value={`${baht(summary.wholesale_amount)} ฿`} small />
      </div>
      {summary.void_count > 0 && (
        <p className="text-sm text-stone-500">มีบิลที่ถูกยกเลิก {summary.void_count} บิล (ไม่นับรวมในยอด)</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  small?: boolean;
}) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "";
  return (
    <div className="card">
      <div className="text-sm text-stone-500">{label}</div>
      <div className={`${small ? "text-xl" : "text-2xl"} font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}
