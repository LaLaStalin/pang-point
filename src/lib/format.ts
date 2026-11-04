import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import buddhistEra from "dayjs/plugin/buddhistEra";
import "dayjs/locale/th";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(buddhistEra);
dayjs.locale("th");

export const TZ = "Asia/Bangkok";

const bahtFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

/** 1234.5 -> "1,234.5" */
export function baht(n: number | string) {
  return bahtFormat.format(Number(n));
}

/** 28/10/69 */
export function fmtDate(iso: string) {
  return dayjs(iso).tz(TZ).format("DD/MM/BB");
}

/** 16:00 */
export function fmtTime(iso: string) {
  return dayjs(iso).tz(TZ).format("HH:mm");
}

/** 28/10/69 16:00 */
export function fmtDateTime(iso: string) {
  return dayjs(iso).tz(TZ).format("DD/MM/BB HH:mm");
}

/** วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD (ใช้กับ <input type="date">) */
export function todayStr() {
  return dayjs().tz(TZ).format("YYYY-MM-DD");
}

/** ช่วงเวลา [from, to) ของวันที่ (เวลาไทย) เป็น ISO */
export function dayRange(fromDate: string, toDate: string = fromDate) {
  return {
    from: dayjs.tz(fromDate, TZ).startOf("day").toISOString(),
    to: dayjs.tz(toDate, TZ).add(1, "day").startOf("day").toISOString(),
  };
}

/** แปลงค่าจาก searchParams ให้เป็นวันที่ YYYY-MM-DD ที่ถูกต้อง ไม่งั้นใช้วันนี้ */
export function parseDateParam(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayStr();
}

/** เลือกช่วงเกิน 1 ปีไหม (ฐานข้อมูลบังคับเพดานนี้ด้วยใน sales_summary และ sales_page_summary) */
export function isRangeTooLong(fromDate: string, toDate: string) {
  return dayjs(toDate).diff(dayjs(fromDate), "day") > 366;
}

/** เวลาเริ่ม/จบของวัน (ค่าเริ่มต้นของช่องเลือกเวลา = ดูทั้งวัน) */
export const DAY_START = "00:00";
export const DAY_END = "23:59";

/** แปลงค่าจาก searchParams ให้เป็นเวลา HH:mm ที่ถูกต้อง ไม่งั้นใช้ fallback */
export function parseTimeParam(v: string | string[] | undefined, fallback: string) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fallback;
}

/**
 * ช่วงเวลา [from, to) จากวันที่ + เวลา (เวลาไทย) เป็น ISO
 * เวลาจบนับรวมทั้งนาทีนั้น เช่น ถึง 12:00 = ถึง 12:00:59
 */
export function dateTimeRange(fromDate: string, fromTime: string, toDate: string, toTime: string) {
  return {
    from: dayjs.tz(`${fromDate} ${fromTime}`, TZ).toISOString(),
    to: dayjs.tz(`${toDate} ${toTime}`, TZ).add(1, "minute").toISOString(),
  };
}
