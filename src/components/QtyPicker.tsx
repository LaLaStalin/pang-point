"use client";

const QUICK_QTY = [1, 2, 3, 4, 5, 10];

export function QtyPicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const qty = Math.floor(Number(value));
  const step = (delta: number) => onChange(String(Math.max(0, qty + delta) || ""));

  return (
    <>
      <div className="grid grid-cols-6 gap-2">
        {QUICK_QTY.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={qty === n}
            onClick={() => onChange(String(n))}
            className={`btn px-0 py-3 text-lg ${
              qty === n ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {/* จำนวนอื่นที่ไม่มีปุ่ม: กด − / + หรือพิมพ์เองได้ */}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn-ghost size-12 shrink-0 p-0 text-2xl" onClick={() => step(-1)} aria-label="ลดจำนวน">
          −
        </button>
        <input
          id={id}
          className="input h-12 min-w-0 flex-1 text-center font-bold"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn-ghost size-12 shrink-0 p-0 text-2xl" onClick={() => step(1)} aria-label="เพิ่มจำนวน">
          +
        </button>
      </div>
    </>
  );
}
