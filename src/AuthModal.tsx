import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { supabase, authRedirectUrl } from "./supabase";
import { Mascot } from "./Mascot";
import { Modal } from "./Modal";
export type AuthMode = "signin" | "signup" | "forgot" | "password";

export function AuthModal({
  initialMode = "signin",
  onClose,
  onComplete,
}: {
  initialMode?: AuthMode;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const title =
    mode === "signup"
      ? "A little Arabic. A place to grow."
      : mode === "forgot"
        ? "Let’s get you back in."
        : mode === "password"
          ? "Choose a new password."
          : "Ahlan, welcome back.";
  function changeMode(next: AuthMode) {
    setMode(next);
    setPassword("");
    setConfirm("");
    setError("");
    setMessage("");
    setShow(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setError("");
    setMessage("");
    if (mode === "signup" || mode === "password") {
      if (Array.from(password).length < 12) {
        setError("Choose a password with at least 12 characters.");
        return;
      }
      if (new TextEncoder().encode(password).length > 72) {
        setError(
          "This password is too long. Use no more than 72 bytes (some characters use more than one byte).",
        );
        return;
      }
      if (password !== confirm) {
        setError("Your passwords don’t match yet.");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error)
          throw new Error(
            error.code === "email_not_confirmed"
              ? "Please confirm your email before signing in. Check your inbox and spam folder."
              : "Couldn’t sign in. Check your email and password, or reset your password.",
          );
        setPassword("");
        onComplete();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: authRedirectUrl(),
          },
        });
        if (error)
          throw new Error(
            error.status === 429
              ? "Too many attempts. Please wait a little before trying again."
              : "Couldn’t create the account. Please try again shortly, or sign in if you already have an account.",
          );
        setPassword("");
        setConfirm("");
        if (data.session) onComplete();
        else
          setMessage(
            "Check your inbox for a confirmation link. Open it in this browser, then sign in. If you already have an account, sign in or reset your password.",
          );
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authRedirectUrl() },
        );
        if (error)
          throw new Error(
            "Couldn’t send the reset email right now. Please wait a little and try again.",
          );
        setMessage(
          "If an account exists for this email, you’ll receive a reset link. Open it in this browser to choose a new password.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error)
          throw new Error(
            "Couldn’t update your password. Try a different password or request a fresh reset link.",
          );
        setPassword("");
        setConfirm("");
        setMessage(
          "Your new password is saved. You’re ready to keep learning.",
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="auth-intro">
        <Mascot happy />
        <div>
          <span className="eyebrow">YOUR JOURNEY, WHEREVER YOU GO</span>
          <p>
            {mode === "signup"
              ? "Keep your name, XP, and learning progress together. Pick up where you left off on another device."
              : mode === "forgot"
                ? "We’ll email you a link to choose a new password."
                : mode === "password"
                  ? "A fresh password, and you’re on your way."
                  : "Your words, little wins, and next lesson are waiting for you."}
          </p>
        </div>
      </div>
      {!supabase ? (
        <div className="notice">
          Accounts aren’t available yet. You can keep learning as a guest.
        </div>
      ) : (
        <>
          {(mode === "signin" || mode === "signup") && !message && (
            <div className="auth-tabs">
              <button
                className={mode === "signin" ? "selected" : ""}
                disabled={busy}
                onClick={() => changeMode("signin")}
              >
                Sign in
              </button>
              <button
                className={mode === "signup" ? "selected" : ""}
                disabled={busy}
                onClick={() => changeMode("signup")}
              >
                Create account
              </button>
            </div>
          )}
          {message ? (
            <div className="auth-success" role="status">
              <CheckCircle2 size={30} />
              <p>{message}</p>
              <button
                className="primary"
                onClick={() =>
                  mode === "password" ? onComplete() : changeMode("signin")
                }
              >
                {mode === "password" ? "Continue learning" : "Back to sign in"}
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  Your first name
                  <input
                    name="name"
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {mode !== "password" && (
                <label>
                  Email address
                  <div className="auth-input">
                    <Mail size={17} />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  {mode === "password" ? "New password" : "Password"}
                  <div className="auth-input">
                    <LockKeyhole size={17} />
                    <input
                      name="password"
                      aria-label={
                        mode === "password" ? "New password" : "Password"
                      }
                      type={show ? "text" : "password"}
                      autoComplete={
                        mode === "signin" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === "signin" ? undefined : 12}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? "Hide password" : "Show password"}
                      aria-pressed={show}
                    >
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {mode !== "signin" && (
                    <small>
                      At least 12 characters. A long, unique passphrase works
                      well.
                    </small>
                  )}
                </label>
              )}
              {(mode === "signup" || mode === "password") && (
                <label>
                  Confirm password
                  <input
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" type="submit" disabled={busy}>
                {busy
                  ? "One moment…"
                  : mode === "signin"
                    ? "Sign in & keep learning"
                    : mode === "signup"
                      ? "Create my account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Save new password"}
                <ArrowRight size={17} />
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => changeMode("forgot")}
                >
                  Forgot your password?
                </button>
              )}
              {mode === "forgot" && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => changeMode("signin")}
                >
                  Back to sign in
                </button>
              )}
            </form>
          )}
          <div className="auth-security">
            <LockKeyhole size={14} />
            <p>
              Passwords travel over HTTPS and are stored as salted hashes by our
              authentication provider. Yalla never saves your password in this
              browser.
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}
