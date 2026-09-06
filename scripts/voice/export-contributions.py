"""Export human-approved recordings privately for a later training/evaluation run.

Requires admin credentials in environment variables. Writes outside the repo.
Does not train, publish, or modify a model.
"""
import argparse
import hashlib
import json
import os
import secrets
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUCKET = "yalla-voice-contributions"


def export_dataset(base, key, output, request=None):
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use a new empty export directory so deleted contributions cannot remain in an old dataset.")
    if output == ROOT or ROOT in output.parents:
        raise ValueError("Keep participant recordings outside the application repository.")
    if not base.startswith("https://"):
        raise ValueError("SUPABASE_URL must use HTTPS")
    output.mkdir(parents=True, exist_ok=True)
    output.chmod(0o700)
    salt = secrets.token_bytes(32)
    if request is None:
        def request(path):
            headers = {"apikey": key, "Authorization": f"Bearer {key}"}
            req = urllib.request.Request(base.rstrip("/") + path, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                return response.read()
    rows = []
    offset = 0
    while True:
        query = urllib.parse.urlencode({"select": "id,user_id,object_path,reviewed_transcript,reviewed_at,consent_version",
            "review_status": "eq.approved", "upload_complete": "eq.true", "order": "created_at.asc,id.asc", "limit": "1000", "offset": offset})
        page = json.loads(request("/rest/v1/voice_contributions?" + query))
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += len(page)
    manifest = []
    for row in rows:
        if not row.get("reviewed_at") or not row.get("reviewed_transcript", "").strip() or row.get("consent_version") not in ("pilot-v1", "optional-v1"):
            continue
        query = urllib.parse.urlencode({"select": "id,user_id,object_path,reviewed_transcript,reviewed_at,consent_version", "id": "eq." + row["id"], "review_status": "eq.approved", "upload_complete": "eq.true"})
        current = json.loads(request("/rest/v1/voice_contributions?" + query))
        if not current:
            continue
        row = current[0]
        path = row["object_path"]
        parts = path.split("/")
        if len(parts) != 2 or parts[0] != row["user_id"] or not parts[1].startswith(row["id"] + "."):
            raise ValueError("Unexpected recording path")
        suffix = Path(path).suffix
        if suffix not in (".webm", ".m4a", ".ogg", ".wav"):
            raise ValueError("Unsupported recording format")
        audio = request("/storage/v1/object/authenticated/" + BUCKET + "/" + urllib.parse.quote(path, safe="/"))
        if not 1 <= len(audio) <= 2097152:
            raise ValueError("Invalid recording size")
        speaker = hashlib.sha256(salt + row["user_id"].encode()).hexdigest()[:20]
        name = row["id"] + suffix
        target = output / name
        target.write_bytes(audio); target.chmod(0o600)
        manifest.append({"id": row["id"], "audio": name, "text": row["reviewed_transcript"],
                         "speaker": speaker, "sha256": hashlib.sha256(audio).hexdigest(),
                         "consent_version": row["consent_version"], "reviewed_at": row["reviewed_at"]})
    (output / "manifest.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in manifest))
    (output / "manifest.jsonl").chmod(0o600)
    return len(manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    base = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key or key.startswith("sb_publishable_"):
        parser.error("Set SUPABASE_URL and an admin SUPABASE_SERVICE_ROLE_KEY in your local environment. Never use a VITE_ variable.")
    count = export_dataset(base, key, args.output.expanduser().resolve())
    print(f"Exported {count} reviewed recordings to {args.output}. A separate training run is required before changing the voice.")


if __name__ == "__main__":
    main()
