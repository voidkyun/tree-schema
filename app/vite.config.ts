import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages はプロジェクトページなので base を /tree-schema/ に。
// ローカル(dev/preview)では "/"。CI で GITHUB_PAGES=1 を立てる。
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/tree-schema/" : "/",
  plugins: [react()],
  worker: { format: "es" },
});
