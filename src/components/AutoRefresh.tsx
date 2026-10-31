"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// ดึงข้อมูลหน้าปัจจุบันใหม่เป็นระยะ และทันทีที่กลับมาเปิดจอ/สลับกลับมาที่แอป
// หยุดทำงานตอนจอดับหรืออยู่แอปอื่น — ไม่เปลืองเน็ต/แบต
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => router.refresh(), intervalMs);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        router.refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
