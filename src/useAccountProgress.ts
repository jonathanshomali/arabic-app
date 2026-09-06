import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import type { User } from "@supabase/supabase-js";
import { emptyProgress, loadProgress, type Progress } from "./data";
import { supabase } from "./supabase";

export type SyncStatus =
  "guest" | "loading" | "saved" | "saving" | "offline" | "error" | "conflict";
type Pending = { progress: Progress; version: number };
const pendingKey = (id: string) => `yalla-pending:${id}`;
function readPending(id: string): Pending | null {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(id)) || "null");
  } catch {
    return null;
  }
}
function validProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object") return false;
  const p = value as Progress;
  return (
    Array.isArray(p.completed) &&
    p.completed.every((n) => Number.isInteger(n) && n >= 0) &&
    Number.isFinite(p.xp) &&
    p.xp >= 0 &&
    typeof p.name === "string" &&
    p.name.length <= 30 &&
    typeof p.sound === "boolean" &&
    [10, 30, 60].includes(p.goal) &&
    Array.isArray(p.saved) &&
    p.saved.every((s) => typeof s === "string") &&
    Number.isFinite(p.practices) &&
    p.practices >= 0 &&
    !!p.activity &&
    typeof p.activity === "object" &&
    !Array.isArray(p.activity) &&
    Object.values(p.activity).every((n) => Number.isFinite(n) && n >= 0)
  );
}

export function useAccountProgress() {
  const [progress, renderProgress] = useState<Progress>(loadProgress);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [status, setStatus] = useState<SyncStatus>(
    supabase ? "loading" : "guest",
  );
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const state = useRef({
    user: null as User | null,
    progress,
    version: 0,
    loaded: !supabase,
    dirty: false,
    generation: 0,
  });
  const running = useRef<Promise<boolean> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const conflict = useRef(false);

  const persistPending = useCallback(() => {
    const s = state.current;
    if (!s.user) return;
    try {
      localStorage.setItem(
        pendingKey(s.user.id),
        JSON.stringify({ progress: s.progress, version: s.version }),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    if (running.current) return running.current;
    const s = state.current;
    if (!supabase || !s.user || !s.loaded || conflict.current)
      return Promise.resolve(!s.dirty);
    const generation = s.generation,
      id = s.user.id;
    const task = (async () => {
      while (state.current.dirty && state.current.generation === generation) {
        if (!navigator.onLine) {
          setStatus("offline");
          setError(
            "Your changes are saved on this device. Reconnect to sync your account.",
          );
          return false;
        }
        setStatus("saving");
        const snapshot = state.current.progress,
          version = state.current.version;
        try {
          const { data, error: saveError } = await supabase
            .rpc("save_learner_progress", {
              p_progress: snapshot,
              p_expected_version: version,
            })
            .abortSignal(AbortSignal.timeout(10000));
          if (state.current.generation !== generation) return false;
          if (saveError) {
            conflict.current = saveError.code === "40001";
            setStatus(conflict.current ? "conflict" : "error");
            setError(
              conflict.current
                ? "Your account changed on another device. Choose which progress to keep."
                : "Your changes are saved on this device, but cloud sync failed. Please retry.",
            );
            return false;
          }
          const row = data?.[0];
          if (!row || !Number.isSafeInteger(row.version))
            throw new Error("Invalid sync response");
          state.current.version = row.version;
          if (state.current.progress === snapshot) {
            state.current.dirty = false;
            try {
              localStorage.removeItem(pendingKey(id));
            } catch {
              setStorageError(true);
            }
          } else persistPending();
        } catch {
          if (state.current.generation === generation) {
            setStatus("error");
            setError(
              "Couldn’t reach your account. Your changes are kept on this device; please retry.",
            );
          }
          return false;
        }
      }
      if (state.current.generation === generation) {
        setStatus("saved");
        setError("");
      }
      return true;
    })();
    running.current = task;
    void task.finally(() => {
      if (running.current === task) running.current = null;
    });
    return task;
  }, [persistPending]);

  const loadCloud = useCallback(
    async (account: User, choice?: "cloud" | "device") => {
      if (!supabase) return;
      const generation = state.current.generation;
      setStatus("loading");
      setError("");
      state.current.loaded = false;
      try {
        const { data, error: loadError } = await supabase
          .from("learner_progress")
          .select("progress, version")
          .eq("user_id", account.id)
          .abortSignal(AbortSignal.timeout(8000))
          .single();
        if (state.current.generation !== generation) return;
        if (
          loadError ||
          !data ||
          !validProgress(data.progress) ||
          !Number.isSafeInteger(data.version)
        )
          throw new Error("Load failed");
        const pending = readPending(account.id);
        const usable =
          pending &&
          validProgress(pending.progress) &&
          Number.isSafeInteger(pending.version)
            ? pending
            : null;
        const keepDevice = usable && choice !== "cloud";
        state.current.version = data.version;
        state.current.progress = keepDevice ? usable.progress : data.progress;
        state.current.loaded = true;
        state.current.dirty = !!keepDevice;
        conflict.current =
          !!keepDevice &&
          usable.version !== data.version &&
          choice !== "device";
        renderProgress(state.current.progress);
        if (choice === "cloud") {
          try {
            localStorage.removeItem(pendingKey(account.id));
          } catch {
            setStorageError(true);
          }
        }
        if (conflict.current) {
          setStatus("conflict");
          setError(
            "Your account changed on another device. Choose which progress to keep.",
          );
        } else if (keepDevice) {
          persistPending();
          void flush();
        } else setStatus("saved");
      } catch {
        if (state.current.generation !== generation) return;
        setStatus("error");
        setError(
          "Couldn’t load your saved progress. Retry before continuing so your account stays safe.",
        );
      }
    },
    [flush, persistPending],
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // Keep this callback synchronous: database work starts in a separate task.
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      const next = session?.user ?? null;
      setAuthReady(true);
      if (next?.id === state.current.user?.id && event !== "INITIAL_SESSION") {
        setUser(next);
        return;
      }
      clearTimeout(debounce.current);
      state.current.generation++;
      state.current.user = next;
      state.current.loaded = !next;
      state.current.dirty = false;
      running.current = null;
      conflict.current = false;
      setUser(next);
      setError("");
      if (next) {
        setStatus("loading");
        state.current.progress = { ...emptyProgress };
        renderProgress(state.current.progress);
      } else {
        state.current.progress = loadProgress();
        renderProgress(state.current.progress);
        setStatus("guest");
        setRecovery(false);
      }
    });
    const timeout = setTimeout(() => {
      if (active && !state.current.loaded && !state.current.user) {
        setError(
          "Account connection is taking longer than expected. Refresh to retry.",
        );
      }
    }, 12000);
    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
      clearTimeout(debounce.current);
      state.current.generation++;
    };
  }, []);

  useEffect(() => {
    if (user) void loadCloud(user);
  }, [user?.id, loadCloud]);
  useEffect(() => {
    const online = () => {
      if (state.current.user) {
        if (state.current.loaded) void flush();
        else void loadCloud(state.current.user);
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty) {
        persistPending();
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", unload);
    };
  }, [flush, loadCloud, persistPending]);

  const setProgress = useCallback(
    (action: SetStateAction<Progress>) => {
      const s = state.current;
      if (!s.loaded || conflict.current) return;
      const next = typeof action === "function" ? action(s.progress) : action;
      s.progress = next;
      renderProgress(next);
      if (!s.user) {
        try {
          localStorage.setItem("yalla-progress", JSON.stringify(next));
          setStorageError(false);
        } catch {
          setStorageError(true);
        }
      } else {
        s.dirty = true;
        persistPending();
        setStatus(navigator.onLine ? "saving" : "offline");
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => void flush(), 350);
      }
    },
    [flush, persistPending],
  );

  async function signOut() {
    if (!supabase) return;
    clearTimeout(debounce.current);
    if (state.current.dirty && !(await flush()))
      throw new Error(
        "Please sync or resolve your pending changes before signing out.",
      );
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Couldn’t sign out. Please retry.");
  }
  function importGuest() {
    const guest = loadProgress();
    setProgress((p) => ({
      ...p,
      completed: [...new Set([...p.completed, ...guest.completed])].sort(
        (a, b) => a - b,
      ),
      xp: Math.max(p.xp, guest.xp),
      practices: Math.max(p.practices, guest.practices),
      saved: [...new Set([...p.saved, ...guest.saved])],
      activity: Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(p.activity),
            ...Object.keys(guest.activity),
          ]),
        ].map((day) => [
          day,
          Math.max(p.activity[day] || 0, guest.activity[day] || 0),
        ]),
      ),
    }));
  }
  const retry = () =>
    state.current.user &&
    (state.current.loaded ? flush() : loadCloud(state.current.user));
  const resolveConflict = (choice: "cloud" | "device") =>
    state.current.user && loadCloud(state.current.user, choice);
  return {
    progress,
    setProgress,
    user,
    authReady,
    status,
    error,
    storageError,
    recovery,
    setRecovery,
    signOut,
    importGuest,
    retry,
    resolveConflict,
    canEdit: authReady && state.current.loaded && !conflict.current,
  };
}
