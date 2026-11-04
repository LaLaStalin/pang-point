/** ข้อความแทนผลลัพธ์ เมื่อเลือกช่วงวันที่ยาวเกินที่ระบบคำนวณให้ */
export function RangeTooLongNotice() {
  return (
    <p className="rounded-xl bg-amber-50 p-4 text-center text-amber-900">
      เลือกช่วงวันที่ได้ไม่เกิน 1 ปี กรุณาเลือกช่วงให้สั้นลงแล้วกดค้นหาอีกครั้ง
    </p>
  );
}
