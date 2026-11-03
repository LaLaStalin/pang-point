"use client";

import { useActionState, useEffect, useState } from "react";
import { login } from "./actions";

const ACCOUNTS = [
  { key: "shop", label: "หน้าร้าน", sub: "ขายขนม" },
  { key: "admin", label: "แอดมิน", sub: "จัดการร้าน" },
] as const;

const MAX_DIGITS = 20;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  // เริ่มที่หน้าร้าน (ใช้บ่อยสุด) กดสลับเป็นแอดมินได้
  const [account, setAccount] = useState<"shop" | "admin">("shop");
  const [pin, setPin] = useState("");
  // นับครั้งที่รหัสผิด ใช้เป็น key ให้แอนิเมชันสั่นเล่นใหม่ทุกครั้ง
  const [errorCount, setErrorCount] = useState(0);

  const press = (key: string) => {
    if (key === "clear") setPin("");
    else if (key === "back") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < MAX_DIGITS ? p + key : p));
  };

  // รหัสผิด -> ล้างให้กดใหม่ + สั่น
  useEffect(() => {
    if (state?.error) {
      setPin("");
      setErrorCount((n) => n + 1);
    }
  }, [state]);

  // รองรับพิมพ์ตัวเลขจากคีย์บอร์ดด้วย
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) setPin((p) => (p.length < MAX_DIGITS ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setPin("");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showError = state?.error && pin.length === 0;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="account" value={account} />
      <input type="hidden" name="password" value={pin} />

      {/* สลับบัญชี */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-stone-100 p-1" role="radiogroup" aria-label="เลือกบัญชี">
        {ACCOUNTS.map((a) => {
          const active = account === a.key;
          return (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setAccount(a.key);
                setPin("");
              }}
              className={`rounded-full py-2 text-sm font-semibold transition ${
                active ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {/* จุดแสดงจำนวนหลักที่กด */}
      <div className="flex h-8 items-center justify-center" aria-live="polite">
        <div key={errorCount} className={`flex flex-wrap justify-center gap-3 ${errorCount > 0 ? "animate-shake" : ""}`}>
          {pin.length === 0 ? (
            <span className={`text-sm ${showError ? "font-medium text-red-600" : "text-stone-400"}`}>
              {showError ? state.error : "กดรหัสผ่าน"}
            </span>
          ) : (
            Array.from(pin).map((_, i) => <span key={i} className="size-3 animate-pop rounded-full bg-amber-500" />)
          )}
        </div>
      </div>

      {/* แป้นตัวเลข */}
      <div className="grid grid-cols-3 justify-items-center gap-y-3">
        {KEYS.map((k) => {
          const fn = k === "clear" || k === "back";
          return (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className={`flex size-18 items-center justify-center rounded-full transition select-none active:scale-95 ${
                fn
                  ? "text-sm font-medium text-stone-400 hover:text-stone-700"
                  : "text-[1.75rem] font-medium text-stone-800 hover:bg-stone-100 active:bg-amber-100"
              }`}
              aria-label={k === "back" ? "ลบ" : k === "clear" ? "ล้าง" : k}
            >
              {k === "back" ? (
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z" strokeLinejoin="round" />
                  <path d="m12 9 5 6m0-6-5 6" strokeLinecap="round" />
                </svg>
              ) : k === "clear" ? (
                "ล้าง"
              ) : (
                k
              )}
            </button>
          );
        })}
      </div>

      <button
        className="btn-primary w-full rounded-full py-3.5 text-lg"
        disabled={pin.length === 0 || pending}
      >
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
