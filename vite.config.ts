import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const url = env.VITE_SUPABASE_URL?.trim();
  if (key) {
    let publicKey = key.startsWith("sb_publishable_");
    if (!publicKey) {
      try {
        publicKey =
          JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
            .role === "anon";
      } catch {
        /* Invalid key. */
      }
    }
    if (!publicKey)
      throw new Error(
        "VITE_SUPABASE_PUBLISHABLE_KEY must be a public publishable/anon key. Never expose a service-role or secret key.",
      );
  }
  if (Boolean(url) !== Boolean(key))
    throw new Error(
      "Set both public Supabase variables, or leave both empty for guest-only mode.",
    );
  if (url && !/^https:\/\/[^/]+\/?$/.test(url))
    throw new Error("The Supabase project URL must be an HTTPS origin.");
  const origin = url ? new URL(url).origin : "";
  const policy = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ${origin}; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'`;
  return {
    plugins: [
      react(),
      ...(command === "build"
        ? [
            {
              name: "production-security-policy",
              transformIndexHtml(html: string) {
                return html.replace(
                  '<meta charset="UTF-8" />',
                  `<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${policy}" /><meta name="referrer" content="no-referrer" />`,
                );
              },
            },
          ]
        : []),
    ],
    base: mode === "github-pages" ? "/arabic-app/" : "/",
    build: {
      rollupOptions: {
        output: { manualChunks: { supabase: ["@supabase/supabase-js"] } },
      },
    },
  };
});
