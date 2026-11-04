"use client";

import Image from "next/image";
import generatePayload from "promptpay-qr";
import { QRCodeSVG } from "qrcode.react";
import { baht } from "@/lib/format";

export function PromptPayQR({
  promptpayId,
  imageUrl,
  amount,
}: {
  promptpayId: string | null;
  imageUrl: string | null;
  amount: number;
}) {
  if (imageUrl) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
        {/* ไม่ผ่านตัวย่อรูป เพื่อไม่ให้ QR เบลอจนสแกนไม่ได้ */}
        <Image
          src={imageUrl}
          alt="QR รับเงิน"
          width={320}
          height={320}
          unoptimized
          className="h-auto max-h-96 w-auto max-w-full object-contain"
        />
        <p className="text-sm text-stone-500">ให้ลูกค้ากรอกยอดเงินเอง</p>
        <p className="text-lg font-semibold">{baht(amount)} บาท</p>
        <p className="text-sm text-stone-500">ตรวจยอดเงินเข้าก่อนกดยืนยัน</p>
      </div>
    );
  }

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
