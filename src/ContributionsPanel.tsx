import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { deleteContribution, type Contribution } from "./voiceContributions";

export function ContributionsPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase
      ?.from("voice_contributions")
      .select(
        "id,user_id,phrase_ar,object_path,seconds,upload_complete,created_at,review_status",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error)
          setMessage(
            "Voice contributions are not available yet. Please try again later.",
          );
        else setRows(data as Contribution[]);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  async function remove(row: Contribution) {
    setBusy(row.id);
    setMessage("");
    try {
      await deleteContribution(row);
      setRows((items) => items.filter((item) => item.id !== row.id));
      setConfirm(null);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Deletion failed. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <details className="contributions-panel">
      <summary>
        Your voice contributions{rows.length ? ` · ${rows.length}` : ""}
      </summary>
      <p>
        Recordings are private to you and Yalla’s review team. Deleting removes
        the recording from the collection and future exports; it can’t undo
        training that already used it.
      </p>
      {loading ? (
        <p>Loading contributions…</p>
      ) : !rows.length && !message ? (
        <p>
          No contributions yet. Record a phrase in a lesson or the Phrasebook.
        </p>
      ) : null}
      {message && <p role="status">{message}</p>}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <span lang="ar" dir="rtl">
                {row.phrase_ar}
              </span>
              <small>
                {!row.upload_complete
                  ? "Incomplete upload"
                  : row.review_status === "pending"
                    ? "Awaiting review"
                    : row.review_status === "approved"
                      ? "Reviewed for training"
                      : "Not selected for training"}{" "}
                · {new Date(row.created_at).toLocaleDateString()}
              </small>
            </div>
            {confirm === row.id ? (
              <div>
                <button
                  type="button"
                  className="danger"
                  disabled={!!busy}
                  onClick={() => void remove(row)}
                >
                  {busy === row.id ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => setConfirm(null)}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-button"
                disabled={!!busy}
                onClick={() => setConfirm(row.id)}
              >
                Delete contribution
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
