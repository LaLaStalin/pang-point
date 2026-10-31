"use client";

import { useActionState, useEffect, useState } from "react";
import { login } from "./actions";

const ACCOUNTS = [
  { key: "shop", label: "หน้าร้าน", sub: "ขายขนม", cls: "bg-amber-500 text-white", idle: "border-amber-300 text-amber-700" },
  { key: "admin", label: "แอดมิน", sub: "จัดการร้าน", cls: "bg-stone-800 text-white", idle: "border-stone-300 text-stone-700" },
] as const;

const MAX_DIGITS = 20;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [account, setAccount] = useState<"shop" | "admin" | null>(null);
  const [pin, setPin] = useState("");

  const press = (key: string) => {
    if (key === "clear") setPin("");
    else if (key === "back") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < MAX_DIGITS ? p + key : p));
  };

  // รหัสผิด -> ล้างให้กดใหม่
  useEffect(() => {
    if (state?.error) setPin("");
  }, [state]);

  // รองรับพิมพ์ตัวเลขจากคีย์บอร์ดด้วย
  useEffect(() => {
    if (!account) return;
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) setPin((p) => (p.length < MAX_DIGITS ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setPin("");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [account]);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="account" value={account ?? ""} />
      <input type="hidden" name="password" value={pin} />
      <div className="grid grid-cols-2 gap-3">
        {ACCOUNTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              setAccount(a.key);
              setPin("");
            }}
            className={`btn flex-col py-5 ${account === a.key ? a.cls : `border-2 bg-white ${a.idle}`}`}
          >
            <span className="text-xl">{a.label}</span>
            <span className="text-sm font-normal opacity-80">{a.sub}</span>
          </button>
        ))}
      </div>

      {account && (
        <div className="space-y-3">
          <p className="label text-center">กดรหัสผ่าน</p>
          <div className="flex min-h-8 flex-wrap items-center justify-center gap-2" aria-live="polite">
            {pin.length === 0 ? (
              <span className="text-stone-400">-</span>
            ) : (
              Array.from(pin).map((_, i) => <span key={i} className="h-4 w-4 rounded-full bg-stone-800" />)
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className={`btn h-16 ${
                  k === "clear" || k === "back"
                    ? "bg-stone-100 text-lg text-stone-600 hover:bg-stone-200"
                    : "border border-stone-300 bg-white text-2xl text-stone-800 hover:bg-amber-50 active:bg-amber-100"
                }`}
                aria-label={k === "back" ? "ลบ" : k === "clear" ? "ล้าง" : k}
              >
                {k === "back" ? "⌫" : k === "clear" ? "ล้าง" : k}
              </button>
            ))}
          </div>
        </div>
      )}

      {state?.error && <p className="text-center text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full py-3 text-lg" disabled={!account || pin.length === 0 || pending}>
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
