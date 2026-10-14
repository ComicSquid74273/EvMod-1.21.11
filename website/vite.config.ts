import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const basePath = process.env.BASE_PATH ?? "/EvMod/";

export default defineConfig({
  base: basePath.endsWith("/") ? basePath : `${basePath}/`,
  server: { port: 8080 },
  build: { target: "esnext" },
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
});