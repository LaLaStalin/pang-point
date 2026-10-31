import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "เจ๊แหม่มสับปะรด",
  description: "ระบบขายขนมและเช็ค stock ร้านเจ๊แหม่มสับปะรด",
  appleWebApp: { capable: true, title: "เจ๊แหม่มสับปะรด", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: ส่วนขยายเบราว์เซอร์บางตัว (เช่น ไม้บรรทัดวัดหน้าจอ) แอบใส่ style ที่ <html> ก่อน React โหลด
    <html lang="th" suppressHydrationWarning>
      <body className={`${thai.variable} min-h-dvh font-sans antialiased`}>{children}</body>
    </html>
  );
}
