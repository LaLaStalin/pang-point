import { PasswordForm } from "./PasswordForm";

export default function AccountsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">รหัสผ่าน</h1>
      <PasswordForm
        account="shop"
        title="หน้าร้าน"
        hint="ใช้ล็อกอินแท็บเล็ตหน้าร้าน — เปลี่ยนแล้วเครื่องที่ล็อกอินอยู่ยังใช้ต่อได้ ไม่ต้องล็อกอินใหม่"
      />
      <PasswordForm account="admin" title="แอดมิน" hint="ห้ามบอกลูกน้อง — บัญชีนี้เห็นต้นทุนและยอดขายทั้งหมด" />
    </div>
  );
}
