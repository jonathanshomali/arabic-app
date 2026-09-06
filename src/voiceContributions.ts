import { supabase } from "./supabase";
import type { Phrase } from "./data";
import type { RecordedTake } from "./useRecorder";

export const CONTRIBUTION_MODE: "pilot" | "optional" = "pilot";
export const RECORDING_NOTICE =
  "During this recording pilot, every take is automatically uploaded for Yalla’s team to review and use in future Palestinian speech-model training. Record only your own voice. You can delete contributions in Settings.";
export const VOICE_BUCKET = "yalla-voice-contributions";
export type Contribution = {
  id: string;
  user_id: string;
  phrase_ar: string;
  object_path: string;
  seconds: number;
  upload_complete: boolean;
  created_at: string;
  review_status: "pending" | "approved" | "rejected";
};
export async function uploadContribution(
  id: string,
  phrase: Phrase,
  lessonId: number,
  take: RecordedTake,
) {
  if (!supabase) throw new Error("Please sign in to contribute recordings.");
  const { data, error } = await supabase
    .rpc("begin_voice_contribution", {
      p_id: id,
      p_phrase_ar: phrase.ar,
      p_lesson_id: lessonId,
      p_seconds: Math.round(take.seconds * 1000) / 1000,
      p_size_bytes: take.blob.size,
      p_mime_type: take.mime,
      p_consent_version:
        CONTRIBUTION_MODE === "pilot" ? "pilot-v1" : "optional-v1",
    })
    .single();
  if (error) throw new Error(error.message);
  const row = data as Contribution;
  if (!row.upload_complete) {
    const { error: uploadError } = await supabase.storage
      .from(VOICE_BUCKET)
      .upload(row.object_path, new Blob([take.blob], { type: take.mime }), {
        contentType: take.mime,
        upsert: false,
      });
    if (
      uploadError &&
      String(uploadError.statusCode) !== "409" &&
      !/already exists|duplicate/i.test(uploadError.message)
    )
      throw new Error(uploadError.message);
    // A retry may encounter an already uploaded object. The RPC checks its actual size.
    const { error: finishError } = await supabase.rpc(
      "complete_voice_contribution",
      { p_id: id },
    );
    if (finishError) throw new Error(finishError.message);
  }
  return row;
}
export async function deleteContribution(
  row: Pick<Contribution, "id" | "object_path">,
) {
  if (!supabase) throw new Error("Please sign in.");
  const { error } = await supabase.storage
    .from(VOICE_BUCKET)
    .remove([row.object_path]);
  if (error) throw new Error(error.message);
  const { error: deleteError } = await supabase.rpc(
    "delete_voice_contribution",
    { p_id: row.id },
  );
  if (deleteError) throw new Error(deleteError.message);
}
