"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";

const ACCOUNTS = [
  { key: "shop", label: "หน้าร้าน", sub: "ขายขนม", cls: "bg-amber-500 text-white", idle: "border-amber-300 text-amber-700" },
  { key: "admin", label: "แม่/ครอบครัว", sub: "จัดการร้าน", cls: "bg-stone-800 text-white", idle: "border-stone-300 text-stone-700" },
] as const;

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [account, setAccount] = useState<"shop" | "admin" | null>(null);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="account" value={account ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        {ACCOUNTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAccount(a.key)}
            className={`btn flex-col py-5 ${account === a.key ? a.cls : `border-2 bg-white ${a.idle}`}`}
          >
            <span className="text-xl">{a.label}</span>
            <span className="text-sm font-normal opacity-80">{a.sub}</span>
          </button>
        ))}
      </div>

      {account && (
        <div>
          <label className="label" htmlFor="password">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full py-3 text-lg" disabled={!account || pending}>
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
