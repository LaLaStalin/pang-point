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
  // ?v=… บังคับให้เบราว์เซอร์โหลดไอคอนใหม่ (เปลี่ยนไอคอนเมื่อไหร่ให้เพิ่มเลขนี้)
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "32x32" },
      { url: "/icon.svg?v=2", type: "image/svg+xml" },
    ],
  },
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
