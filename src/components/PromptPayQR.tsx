"use client";

import generatePayload from "promptpay-qr";
import { QRCodeSVG } from "qrcode.react";
import { baht } from "@/lib/format";

export function PromptPayQR({ promptpayId, amount }: { promptpayId: string | null; amount: number }) {
  if (!promptpayId) {
    return (
      <p className="rounded-xl bg-stone-100 p-4 text-center text-stone-600">
        ยังไม่ได้ตั้งเลขพร้อมเพย์ — ให้ลูกค้าโอนตามปกติ แล้วตรวจยอดเงินเข้าก่อนกดยืนยัน
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
      <QRCodeSVG value={generatePayload(promptpayId, { amount })} size={220} marginSize={2} />
      <p className="text-lg font-semibold">{baht(amount)} บาท</p>
      <p className="text-sm text-stone-500">ตรวจยอดเงินเข้าก่อนกดยืนยัน</p>
    </div>
  );
}
