import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "recharts": path.resolve(__dirname, "./node_modules/recharts/es6/index.js"),
      "recharts-scale": path.resolve(__dirname, "./node_modules/recharts-scale/es6/index.js"),
    },
  },
}));
