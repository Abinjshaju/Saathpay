import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    allowedHosts: ["unclearing-hanh-symbolically.ngrok-free.dev"],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "SaathPay",
        short_name: "SaathPay",
        description: "Automated payment management for gyms, yoga & dance studios",
        start_url: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#F0F2F5",
        background_color: "#F0F2F5",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
