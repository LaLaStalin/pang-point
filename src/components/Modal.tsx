"use client";

import { useEffect, useRef } from "react";

// <dialog> ของเบราว์เซอร์: ลอยเหนือทุกอย่าง กด Tab ไม่หลุดออกนอกกล่อง และโฟกัสเริ่มที่ปุ่มแรก (ให้วางปุ่มยกเลิกก่อน)
// กด Esc หรือแตะพื้นหลังเพื่อปิด ยกเว้นระหว่างกำลังบันทึก (locked)
export function Modal({
  labelledBy,
  locked,
  onClose,
  children,
}: {
  labelledBy: string;
  locked: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="m-auto w-[calc(100%-2rem)] max-w-md animate-dialog-in rounded-3xl bg-white p-0 text-left font-normal whitespace-normal text-stone-900 shadow-2xl backdrop:bg-stone-900/50 backdrop:backdrop-blur-sm"
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
    >
      <div className="space-y-5 p-6">{children}</div>
    </dialog>
  );
}
