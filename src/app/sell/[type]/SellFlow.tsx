"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { baht, fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_LABEL, PRICE_TYPE_LABEL, type PaymentMethod, type PriceType, type Product } from "@/lib/types";

// โหลดตัวสร้าง QR เฉพาะตอนเลือกพร้อมเพย์ หน้าขายจะได้เปิดเร็ว
const PromptPayQR = dynamic(() => import("@/components/PromptPayQR").then((m) => m.PromptPayQR), {
  ssr: false,
  loading: () => <p className="p-8 text-center text-stone-500">กำลังสร้าง QR...</p>,
});

type Step = "items" | "pay" | "done";

type Line = { product: Product; unitPrice: number; qty: number };

type Receipt = {
  id: number;
  soldAt: string;
  lines: Line[];
  totalQty: number;
  total: number;
  received: number;
  change: number;
  method: PaymentMethod;
};

const CASH_NOTES = [20, 50, 100, 500, 1000];

// รหัสบิลจากหน้าจอ — ส่งซ้ำด้วยรหัสเดิม (เน็ตหลุดแล้วกดยืนยันใหม่) ระบบจะไม่สร้างบิลซ้ำ
function newClientRef() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // เบราว์เซอร์เก่า / เปิดผ่าน http ที่ไม่ใช่ localhost
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ซื้อรวมตั้งแต่จำนวนนี้ขึ้นไปต้องเป็นบิลราคาส่ง
const WHOLESALE_MIN_QTY = 10;

const THEME = {
  retail: { bar: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-400", soft: "bg-amber-50" },
  wholesale: { bar: "bg-sky-600", text: "text-sky-700", ring: "ring-sky-400", soft: "bg-sky-50" },
} as const;

export function SellFlow({
  priceType,
  products: initialProducts,
  promptpayId,
  initialQty,
}: {
  priceType: PriceType;
  products: Product[];
  promptpayId: string | null;
  initialQty: Record<number, number>;
}) {
  const router = useRouter();
  const theme = THEME[priceType];
  const [products, setProducts] = useState(initialProducts);
  const [step, setStep] = useState<Step>("items");
  const [qty, setQty] = useState<Record<number, number>>(initialQty);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChanged, setPriceChanged] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // สร้างใหม่ทุกครั้งที่เข้าขั้นรับเงิน รายการในบิลจึงตรงกับรหัสนี้เสมอ
  const [clientRef, setClientRef] = useState("");

  const tiers = products.filter((p) => p.kind === "tier");
  const others = products.filter((p) => p.kind === "other");
  const priceOf = (p: Product) => (priceType === "retail" ? p.retail_price : p.wholesale_price);

  const lines: Line[] = products
    .filter((p) => (qty[p.id] ?? 0) > 0)
    .map((p) => ({ product: p, unitPrice: priceOf(p), qty: qty[p.id] }));
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const receivedNum = Number(received) || 0;
  const change = receivedNum - total;
  const mustBeWholesale = priceType === "retail" && totalQty >= WHOLESALE_MIN_QTY;
  const canConfirm = method === "promptpay" || (received !== "" && change >= 0);

  function setProductQty(id: number, value: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(9999, Math.floor(value) || 0)) }));
  }

  const cartParam = () => lines.map((l) => `${l.product.id}:${l.qty}`).join(",");

  function moveToWholesale() {
    router.replace(`/sell/wholesale?cart=${cartParam()}`);
  }

  // แอดมินเพิ่งแก้ราคา -> โหลดหน้าใหม่ทั้งหน้าให้ได้ราคาล่าสุด โดยยกรายการในบิลไปด้วย
  function reloadPrices() {
    window.location.href = `/sell/${priceType}?cart=${cartParam()}`;
  }

  function goPay() {
    setClientRef(newClientRef());
    setError(null);
    setPriceChanged(false);
    setStep("pay");
  }

  function resetBill() {
    setQty({});
    setMethod("cash");
    setReceived("");
    setError(null);
    setReceipt(null);
    setStep("items");
    // ล้าง ?cart ที่ยกมาจากบิลปลีก ไม่ให้รีเฟรชแล้วรายการเดิมกลับมา
    if (Object.keys(initialQty).length > 0) router.replace(`/sell/${priceType}`);
  }

  async function confirmSale() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_sale", {
      p_price_type: priceType,
      p_payment_method: method,
      p_received: method === "cash" ? receivedNum : total,
      p_items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
      p_expected_total: Math.round(total * 100) / 100,
      p_client_ref: clientRef,
    });
    setSubmitting(false);

    if (error) {
      setPriceChanged(error.hint === "price_changed");
      setError(error.message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }

    setReceipt({
      id: data.id,
      soldAt: data.sold_at,
      lines,
      totalQty: data.total_qty,
      total: Number(data.total_amount),
      received: Number(data.received_amount),
      change: Number(data.change_amount),
      // บิลที่บันทึกไปแล้วก่อนหน้า (ส่งซ้ำ) ใช้วิธีจ่ายที่บันทึกไว้จริง
      method: data.payment_method ?? method,
    });
    // อัปเดต stock ในหน้าจอ (ไว้แสดงคำเตือน) โดยไม่ต้องโหลดใหม่
    setProducts((ps) => ps.map((p) => ({ ...p, qty_on_hand: p.qty_on_hand - (qty[p.id] ?? 0) })));
    setStep("done");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className={`${theme.bar} sticky top-0 z-20 text-white`}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="btn bg-white/20 px-3 py-1.5 hover:bg-white/30">
            ← หน้าแรก
          </Link>
          <h1 className="text-xl font-bold">บิลราคา{PRICE_TYPE_LABEL[priceType]}</h1>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-sm opacity-90">
              {step === "items" ? "1. เลือกขนม" : step === "pay" ? "2. รับเงิน" : "3. สรุปบิล"}
            </span>
            {/* จุดบอกขั้นตอน: ขั้นปัจจุบันเป็นขีดยาว ขั้นที่ผ่านแล้วจางลง */}
            <div className="flex gap-1" aria-hidden>
              {(["items", "pay", "done"] as const).map((s, i, all) => {
                const current = all.indexOf(step);
                return (
                  <span
                    key={s}
                    className={`h-1.5 rounded-full bg-white transition-all ${
                      i === current ? "w-6" : i < current ? "w-1.5 opacity-60" : "w-1.5 opacity-30"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {step === "items" && (
        <>
          <main className={`mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 ${mustBeWholesale ? "pb-60" : "pb-32"}`}>
            {tiers.map((p) => (
              <TierRow
                key={p.id}
                product={p}
                unitPrice={priceOf(p)}
                qty={qty[p.id] ?? 0}
                onChange={(v) => setProductQty(p.id, v)}
                accent={theme.text}
              />
            ))}

            {others.length > 0 && (
              <section className="card">
                <h2 className="mb-1 text-lg font-bold">อื่นๆ (ราคาเต็ม)</h2>
                <p className="mb-3 text-sm text-stone-500">แตะที่ราคาเพื่อเพิ่มทีละ 1 ชิ้น</p>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {others.map((p) => (
                    <OtherTile
                      key={p.id}
                      product={p}
                      qty={qty[p.id] ?? 0}
                      onChange={(v) => setProductQty(p.id, v)}
                      ring={theme.ring}
                    />
                  ))}
                </div>
              </section>
            )}
          </main>

          {mustBeWholesale && (
            <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 px-4">
              <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl bg-sky-600 p-4 text-white shadow-lg">
                <div className="flex-1">
                  <div className="text-lg font-bold">⚠ ซื้อ {totalQty} ชิ้น ต้องใช้ราคาส่ง</div>
                  <div className="text-sm opacity-90">ครบ {WHOLESALE_MIN_QTY} ชิ้นขึ้นไป ขายราคาปลีกไม่ได้</div>
                </div>
                <button className="btn bg-white px-5 py-3 text-lg text-sky-700 hover:bg-sky-50" onClick={moveToWholesale}>
                  ไปบิลราคาส่ง →
                </button>
              </div>
            </div>
          )}

          <BottomBar>
            <div className="flex-1">
              <div className="text-sm text-stone-500">รวม {totalQty} ชิ้น</div>
              <div className="text-2xl font-bold">{baht(total)} ฿</div>
            </div>
            {totalQty > 0 && (
              <button className="btn-ghost" onClick={() => setQty({})}>
                ล้าง
              </button>
            )}
            <button
              className="btn-success px-8 py-3 text-lg"
              disabled={totalQty === 0 || mustBeWholesale}
              onClick={goPay}
            >
              ถัดไป →
            </button>
          </BottomBar>
        </>
      )}

      {step === "pay" && (
        <>
          <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 pb-32">
            <section className="card">
              <BillLines lines={lines} />
              <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-stone-300 pt-3">
                <span className="text-stone-600">ยอดรวม {totalQty} ชิ้น</span>
                <span className="text-3xl font-bold">{baht(total)} ฿</span>
              </div>
            </section>

            <section className="card space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["cash", "promptpay"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`btn py-4 text-lg ${
                      method === m ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700"
                    }`}
                  >
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>

              {method === "cash" ? (
                <div className="space-y-3">
                  <div>
                    <label className="label" htmlFor="received">
                      รับเงินมา (บาท)
                    </label>
                    <input
                      id="received"
                      className="input text-center text-3xl font-bold"
                      inputMode="decimal"
                      type="number"
                      min={0}
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                    <button className="btn-primary" onClick={() => setReceived(String(total))}>
                      พอดี
                    </button>
                    {CASH_NOTES.map((n) => (
                      <button
                        key={n}
                        className="btn-ghost"
                        onClick={() => setReceived(String(receivedNum + n))}
                      >
                        +{n}
                      </button>
                    ))}
                    <button className="btn-ghost text-red-600" onClick={() => setReceived("")}>
                      ล้าง
                    </button>
                  </div>
                  {received !== "" && (
                    <div
                      className={`rounded-xl p-4 text-center ${change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                    >
                      <div className="text-sm">{change >= 0 ? "เงินทอน" : "ยังขาดอีก"}</div>
                      <div className="text-4xl font-bold">{baht(Math.abs(change))} ฿</div>
                    </div>
                  )}
                </div>
              ) : (
                <PromptPayQR promptpayId={promptpayId} amount={total} />
              )}

              {error && (
                <div className="space-y-2 rounded-lg bg-red-50 p-3 text-red-700">
                  <p>{error}</p>
                  {priceChanged && (
                    <button className="btn-primary w-full py-3" onClick={reloadPrices}>
                      โหลดราคาใหม่ (รายการในบิลยังอยู่)
                    </button>
                  )}
                </div>
              )}
            </section>
          </main>

          <BottomBar>
            <button className="btn-ghost px-6 py-3" onClick={() => setStep("items")} disabled={submitting}>
              ← ย้อนกลับ
            </button>
            <button
              className="btn-success flex-1 py-3 text-lg"
              disabled={!canConfirm || submitting}
              onClick={confirmSale}
            >
              {submitting ? "กำลังบันทึก..." : "ยืนยันรับเงิน"}
            </button>
          </BottomBar>
        </>
      )}

      {step === "done" && receipt && (
        <>
          <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 pb-32">
            <section className="card">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">สรุปบิล</h2>
                  <p className="text-sm text-stone-500">
                    #{receipt.id} · ราคา{PRICE_TYPE_LABEL[priceType]} · {PAYMENT_LABEL[receipt.method]}
                  </p>
                </div>
                <span className="text-right text-stone-600">{fmtDateTime(receipt.soldAt)} น.</span>
              </div>
              <BillLines lines={receipt.lines} />
              <div className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-3">
                <Row label={`ยอดรวม ${receipt.totalQty} ชิ้น`} value={`${baht(receipt.total)} ฿`} strong />
                <Row label="รับเงิน" value={`${baht(receipt.received)} ฿`} />
              </div>
            </section>

            {receipt.method === "cash" && (
              <section className="rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-100">
                <div className="text-base font-medium text-emerald-700">ทอนเงิน</div>
                <div className="mt-1 text-6xl font-bold text-emerald-800">{baht(receipt.change)} ฿</div>
              </section>
            )}
          </main>

          <BottomBar>
            <Link href="/" className="btn-ghost px-6 py-3">
              หน้าแรก
            </Link>
            <button className="btn-success flex-1 py-3 text-lg" onClick={resetBill}>
              ขายบิลใหม่ (ราคา{PRICE_TYPE_LABEL[priceType]})
            </button>
          </BottomBar>
        </>
      )}
    </div>
  );
}

function TierRow({
  product,
  unitPrice,
  qty,
  onChange,
  accent,
}: {
  product: Product;
  unitPrice: number;
  qty: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  const overStock = qty > 0 && qty > product.qty_on_hand;
  return (
    <section className="card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <span className={`text-4xl font-bold ${accent}`}>{baht(unitPrice)}</span>
          <span className="ml-1 text-lg">บาท</span>
          <span className="ml-3 text-stone-600">{product.name}</span>
        </div>
        {qty > 0 && <span className="font-semibold">{baht(qty * unitPrice)} ฿</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost size-14 shrink-0 p-0 text-2xl"
          onClick={() => onChange(qty - 1)}
          aria-label="ลด"
        >
          −
        </button>
        <input
          className="input h-14 min-w-0 flex-1 text-center text-2xl font-bold"
          type="number"
          inputMode="numeric"
          min={0}
          value={qty === 0 ? "" : qty}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={(e) => e.target.select()}
          aria-label={`จำนวน ${product.name}`}
        />
        <button
          className="btn-primary size-14 shrink-0 p-0 text-2xl"
          onClick={() => onChange(qty + 1)}
          aria-label="เพิ่ม"
        >
          +
        </button>
        <button className="btn-ghost h-14 shrink-0 px-3" onClick={() => onChange(qty + 5)}>
          +5
        </button>
        <button className="btn-ghost h-14 shrink-0 px-3" onClick={() => onChange(qty + 10)}>
          +10
        </button>
      </div>
      <p className={`mt-2 text-sm ${overStock ? "font-medium text-orange-600" : "text-stone-400"}`}>
        {overStock
          ? `⚠ ในระบบเหลือ ${product.qty_on_hand} ชิ้น (ขายได้ แต่แจ้งเจ๊ให้เช็ค stock)`
          : `เหลือในระบบ ${product.qty_on_hand} ชิ้น`}
      </p>
    </section>
  );
}

function OtherTile({
  product,
  qty,
  onChange,
  ring,
}: {
  product: Product;
  qty: number;
  onChange: (v: number) => void;
  ring: string;
}) {
  const overStock = qty > 0 && qty > product.qty_on_hand;
  return (
    <div className={`relative rounded-2xl border bg-white ${qty > 0 ? `ring-2 ${ring} border-transparent` : "border-stone-200"}`}>
      <button
        className="flex w-full flex-col items-center rounded-2xl px-2 py-4 transition active:scale-95"
        onClick={() => onChange(qty + 1)}
      >
        <span className="text-3xl font-bold">{baht(product.retail_price)}</span>
        <span className="text-sm text-stone-500">บาท</span>
        <span className={`mt-1 text-xs ${overStock ? "text-orange-600" : "text-stone-400"}`}>
          เหลือ {product.qty_on_hand}
        </span>
      </button>
      {qty > 0 && (
        <>
          <span className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-stone-800 text-sm font-bold text-white">
            {qty}
          </span>
          <button
            className="absolute -top-2 -left-2 flex size-8 items-center justify-center rounded-full border border-stone-300 bg-white text-lg font-bold text-stone-700"
            onClick={() => onChange(qty - 1)}
            aria-label={`ลด ${product.name}`}
          >
            −
          </button>
        </>
      )}
    </div>
  );
}

function BillLines({ lines }: { lines: Line[] }) {
  return (
    <ul className="space-y-1.5">
      {lines.map((l) => (
        <li key={l.product.id} className="flex justify-between gap-2 text-lg">
          <span>
            {l.product.kind === "tier" ? `${l.product.name} ${baht(l.unitPrice)} บาท` : `อื่นๆ ${baht(l.unitPrice)} บาท`}
            <span className="text-stone-500"> × {l.qty}</span>
          </span>
          <span className="font-medium">{baht(l.qty * l.unitPrice)}</span>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-2xl font-bold" : "text-lg text-stone-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">{children}</div>
    </div>
  );
}
