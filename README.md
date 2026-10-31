# ปังพอยต์ — เจ๊แหม่มสับปะรด

ระบบขายขนม เช็ค stock และคำนวณกำไร สำหรับฝั่งขนมของร้านเจ๊แหม่มสับปะรด

มี 2 บัญชี เลือกที่หน้าล็อกอินแล้วใส่แค่รหัสผ่าน:

- **หน้าร้าน** (`shop@pangpoint.local`, role `staff`): แท็บเล็ตหน้าร้าน ขายอย่างเดียว เลือกบิลปลีกหรือส่ง → กรอกจำนวน → รับเงิน (เงินสด/พร้อมเพย์) → สรุปบิลและเงินทอน
- **แม่/ครอบครัว** (`admin@pangpoint.local`, role `admin`): เพิ่ม stock พร้อมต้นทุน, ตัดของเสีย/ชิม (ต้องใส่หมายเหตุ), ดูประวัติ, ยกเลิกบิล, รายงานกำไร, ตั้งค่าราคา, เปลี่ยนรหัสผ่าน

อีเมลเป็นแค่ชื่อบัญชีภายในที่ Supabase บังคับให้มี ไม่มีการส่งอีเมลจริง สิทธิ์ถูกบังคับที่ฐานข้อมูลด้วย RLS บัญชีหน้าร้านจึงอ่านต้นทุน ยอดขาย หรือประวัติไม่ได้ แม้จะเรียก API เองก็ตาม

## Tech stack

Next.js 15 (App Router) + TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Vercel

## กติกาธุรกิจ

| กลุ่ม | ปลีก | ส่ง | หมายเหตุ |
|---|---|---|---|
| ขนมแห้ง | 15 | 14 | |
| ขนมปัง | 20 | 16 | |
| อื่นๆ | ราคาเต็ม | ราคาเต็ม | นับ stock รวมตามราคา (เช่น "อื่นๆ 80 บาท") |

- 1 บิล = ราคาปลีกทั้งบิล หรือราคาส่งทั้งบิล (ไม่ผสม)
- ต้นทุนใช้ **ต้นทุนเฉลี่ยถ่วงน้ำหนัก** ต่อกลุ่ม คำนวณใหม่เฉพาะตอนเพิ่ม stock ส่วนตอนขายหรือตัดของจะเก็บต้นทุน ณ ตอนนั้นไว้ในรายการ
- ขายได้แม้ stock ในระบบไม่พอ (stock จะติดลบและแสดงเตือน) เพื่อไม่ให้ลูกค้ารอ
- ราคาที่ใช้คิดเงินอ่านจากฐานข้อมูลในฟังก์ชัน `create_sale` ไม่เชื่อตัวเลขที่ส่งมาจากหน้าเว็บ

## ติดตั้ง

### 1. Supabase

1. สร้างโปรเจคที่ [supabase.com](https://supabase.com) (แนะนำ region Singapore)
2. เปิด **SQL Editor** แล้วรันไฟล์ใน [supabase/migrations/](supabase/migrations/) **ตามลำดับชื่อไฟล์** ทีละไฟล์
   (หรือใช้ CLI: `npx supabase link` แล้ว `npx supabase db push`)
3. **Authentication → Sign In / Providers → Email**: ปิด *Allow new users to sign up*
4. สร้าง 2 บัญชี: เปิด [supabase/setup_accounts.sql](supabase/setup_accounts.sql) แก้ `CHANGE_ME_ADMIN` และ `CHANGE_ME_SHOP` เป็นรหัสที่ต้องการ แล้ววางใน SQL Editor และกด Run
   (อย่า commit ไฟล์ที่ใส่รหัสจริง ภายหลังเปลี่ยนรหัสได้ในเว็บที่ **จัดการร้าน → รหัสผ่าน**)

### 2. รันบนเครื่อง

```bash
cp .env.example .env.local   # ใส่ค่าจาก Supabase → Project Settings → API
npm install
npm run dev
```

### 3. Deploy ขึ้น Vercel

1. push โค้ดขึ้น GitHub แล้ว import โปรเจคใน Vercel
2. ใส่ Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. ตั้งชื่อโปรเจคเป็น `jae-maem-sapparot` (หรือชื่อที่ต้องการ) จะได้ลิงก์ `jae-maem-sapparot.vercel.app`
4. Project Settings → Node.js Version เลือก 22.x

ใช้บนแท็บเล็ตหรือมือถือ: เปิดเว็บแล้วกด "เพิ่มไปยังหน้าจอโฮม" จะใช้เหมือนแอป

## โครงสร้าง

```
supabase/migrations/   schema, RLS, ฟังก์ชัน create_sale / add_stock / adjust_stock / void_sale / sales_summary / admin_set_password
supabase/setup_accounts.sql  สร้างบัญชี admin / shop (รันครั้งเดียว)
src/app/page.tsx       หน้าแรก เลือก ปลีก / ส่ง
src/app/sell/[type]/   หน้าขาย (เลือกขนม → รับเงิน → สรุปบิล)
src/app/admin/         หน้าของ admin ทั้งหมด (ร้านที่ซื้อ: admin/stock/suppliers)
src/lib/               supabase client, auth, format วันที่/เงิน, types
```
