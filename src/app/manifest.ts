import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "เจ๊แหม่มสับปะรด",
    short_name: "เจ๊แหม่ม",
    description: "ระบบขายขนมและเช็ค stock",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf7",
    theme_color: "#f59e0b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
