"use client";

import { useState, useTransition } from "react";
import type { Account } from "@/lib/auth";
import { setPassword } from "./actions";

export function PasswordForm({ account, title, hint }: { account: Account; title: string; hint: string }) {
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm !== "" && password !== confirm;
  const canSubmit = password.length >= 6 && password === confirm;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await setPassword(account, password);
      if (res.ok) {
        setMessage({ ok: true, text: "เปลี่ยนรหัสผ่านแล้ว" });
        setPasswordValue("");
        setConfirm("");
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-stone-500">{hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">รหัสใหม่ (อย่างน้อย 6 ตัว)</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
          />
        </label>
        <label>
          <span className="label">พิมพ์ซ้ำอีกครั้ง</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      </div>
      {mismatch && <p className="text-sm text-red-600">รหัสทั้งสองช่องไม่ตรงกัน</p>}
      {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      <button className="btn-primary" disabled={!canSubmit || pending} onClick={submit}>
        {pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
      </button>
    </section>
  );
}
