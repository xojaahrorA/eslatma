import type { MetadataRoute } from "next";

// Statik eksport (APK build) uchun ham mos — manifest to'liq statik
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Universal Life OS",
    short_name: "Life OS",
    description:
      "Kundalik hayot, maqsadlar, bilimlar va qurilmalarni birlashtiruvchi shaxsiy boshqaruv tizimi.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12101c",
    theme_color: "#12101c",
    categories: ["productivity", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
