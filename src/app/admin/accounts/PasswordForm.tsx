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
  // แอดมินเห็นต้นทุน/กำไรและเปลี่ยนรหัสได้ทุกบัญชี จึงต้องยาวกว่า (ตรงกับ admin_set_password)
  const minDigits = account === "admin" ? 8 : 6;
  const tooShort = password !== "" && password.length < minDigits;
  const canSubmit = password.length >= minDigits && password === confirm;
  const digitsOnly = (v: string) => v.replace(/\D/g, "");

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
          <span className="label">รหัสใหม่ (ตัวเลขอย่างน้อย {minDigits} หลัก)</span>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPasswordValue(digitsOnly(e.target.value))}
          />
        </label>
        <label>
          <span className="label">พิมพ์ซ้ำอีกครั้ง</span>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(digitsOnly(e.target.value))}
          />
        </label>
      </div>
      {tooShort && <p className="text-sm text-stone-500">ต้องมีอย่างน้อย {minDigits} หลัก</p>}
      {mismatch &&<p className="text-sm text-red-600">รหัสทั้งสองช่องไม่ตรงกัน</p>}
      {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      <button className="btn-primary" disabled={!canSubmit || pending} onClick={submit}>
        {pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
      </button>
    </section>
  );
}
