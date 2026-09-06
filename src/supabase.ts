import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function isPublicKey(value: string) {
  if (value.startsWith("sb_publishable_")) return true;
  try {
    const payload = value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).role === "anon";
  } catch {
    return false;
  }
}
export const authConfigured = Boolean(
  url && /^https:\/\//.test(url) && key && isPublicKey(key),
);
export const supabase = authConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "yalla-auth",
        flowType: "pkce",
      },
    })
  : null;
export const authRedirectUrl = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).href;
