import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub project sites live below the repository name; local development
  // and ordinary production builds keep their existing root URL.
  base: mode === "github-pages" ? "/arabic-app/" : "/",
}));
