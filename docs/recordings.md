# Native-speaker recording pilot

Signed-in participants can record any of the 80 learning phrases from the lesson
card or the microphone button in the Phrasebook. Phrasebook access does not
require unlocking lessons. Each completed take is automatically contributed in
**pilot mode**, as requested for the consented native-speaker group.

The capture button says **Record & contribute**, with the following notice before
microphone access is requested:

> During this recording pilot, every take is automatically uploaded for Yalla’s team to review and use in future Palestinian speech-model training. Record only your own voice. You can delete contributions in Settings.

Recordings stop after 20 seconds, on closing the recording view, or when the page
is hidden. Closing during capture discards the partial take. Completed recordings
have playback, a local download, and automatic upload. Failed uploads retain the
take on the page for an idempotent retry; leaving the page loses that local copy.
Record another take creates an additional submission; it does not replace a
previous contribution. No recording changes XP or counts as a correct answer.

Settings → **Your voice contributions** lists submissions and allows deletion.
Deleting removes the original file and metadata from future exports. It cannot
reverse learning from an already trained model or erase an older offline export;
use fresh exports and remove withdrawn IDs from working datasets before training.

## Backend

Apply `supabase/migrations/202609060002_voice_contributions.sql` in Supabase’s SQL
Editor. It creates a private `yalla-voice-contributions` bucket, metadata table,
owner-only access policies, and reservation/completion/deletion RPCs. No service
key belongs in the frontend, GitHub Pages build, or a VITE_ environment variable.

The browser first reserves a UUID for the signed-in participant, uploads to that
reserved path without overwriting, then confirms actual storage size before
marking the contribution complete. Retries reuse the same UUID. Clients cannot
approve samples, edit metadata, or read another participant’s audio. Limit: 2 MiB
per file, 100 reservations in a rolling day, 200 retained submissions per user.
Incomplete reservations are visible in Settings and can be deleted there.

The recorder shows the active microphone and a live input meter. After permission
is granted, participants can select another microphone for their next take. If
the meter stays flat while speaking, check the selected input and its mute/input
volume in the browser and operating system settings.

Capture uses the browser's encoder, waits for its final data before releasing the
microphone, then decodes the complete recording locally. Silent/near-silent or
unreadable takes are rejected before any upload. Accepted takes become mono
24 kHz PCM WAV files for playback and upload, using the strongest input channel,
removing DC offset, and applying at most a 12x gain with a 0.8 peak target. Browser
echo cancellation, noise suppression, and automatic gain are disabled for capture.
Duration metadata comes from the decoded audio. Older recordings retain their
original browser formats; the change cannot recover speech from a silent file.

The signal check detects silence, not speech or correct pronunciation. Actual
audio quality, accent, and transcription still need review; client-supplied
metadata is not proof of these properties.

## Review and use for model improvement

Nothing is automatically trained or added to the public voice. A reviewer with
Supabase administrator access should:

1. Open `voice_contributions` in the Table Editor and choose a completed pending row.
2. Download its `object_path` from the private Storage bucket and listen to it.
3. Check that the correct phrase is spoken clearly in the intended Palestinian
   dialect, without background speakers or personal information. Reject unsuitable takes.
4. For a usable take, fill `reviewed_transcript` with what is actually spoken,
   `reviewed_at` with the review time, and optionally `reviewer_note`; set
   `review_status` to `approved`. The database prevents approval without a
   completed upload and review fields.

Export approved recordings using admin credentials supplied only in your local
environment (do not paste them into chat or commit them):

```sh
python3 scripts/voice/export-contributions.py --output /tmp/yalla-reviewed-2026-09-06
```

The script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, requires a new
empty destination outside this repository, rechecks approval before downloading,
and writes restricted local files plus `manifest.jsonl`. Speaker labels are
pseudonyms, and the manifest contains no account email or raw user ID. Review
consent and membership in the pilot before exporting.

For a later training run: decode and validate recordings, normalize to the base
model’s required format, curate accurate phoneme/text pairs, and split evaluation
data by speaker so the same voices do not leak across training and evaluation.
Compare held-out phrases and native-speaker judgments against the current voice
before deploying any fine-tuned checkpoint. This release implements collection,
review, and dataset export; it does not start a training job.

## Consumer launch

Change `CONTRIBUTION_MODE` in `src/voiceContributions.ts` from `pilot` to `optional`.
The UI then starts with contribution unchecked and allows private local practice;
only an explicit checked choice submits recordings. Consent metadata changes to
`optional-v1`. Review this flow before launching to consumers. The current site
remains publicly reachable, so the pilot notice and sign-in requirement are
visible to anyone who opens recording.

## Checks

- `npm run test:accounts`: actual browser MediaRecorder capture with a fake test microphone,
  automatic submissions through mocked APIs, retry identity, deletion, denied access,
  and capture cleanup. Additional controlled silent/quiet inputs verify silence
  rejection, microphone selection, and measurable sound through the actual
  playback element. No test microphone audio is sent to the live project.
- `npm run test:security`: PostgreSQL access, upload reservations, review,
  and cross-account isolation using PGlite with a minimal Storage schema.
- `python3 -m unittest discover -s scripts/voice -p 'test_contribution_export.py'`:
  current approval, withdrawal recheck, and pseudonymous metadata.

Browser recording uses [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder);
cloud files use [Supabase Storage access policies](https://supabase.com/docs/guides/storage/security/access-control).
