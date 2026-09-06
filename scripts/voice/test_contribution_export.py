import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("exporter", Path(__file__).with_name("export-contributions.py"))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTests(unittest.TestCase):
    def test_only_currently_approved_recordings_are_downloaded_without_user_ids(self):
        uid = "11111111-1111-4111-8111-111111111111"
        row = {"id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "user_id": uid,
               "reviewed_transcript": "مرحبا", "reviewed_at": "2026-09-06T00:00:00Z", "consent_version": "pilot-v1"}
        row["object_path"] = uid + "/" + row["id"] + ".webm"
        revoked = {**row, "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
        calls = []
        def request(path):
            calls.append(path)
            if "order=" in path:
                self.assertIn("review_status=eq.approved", path)
                return json.dumps([row, revoked]).encode()
            if "id=eq." + revoked["id"] in path: return b"[]"
            if path.startswith("/rest/"): return json.dumps([row]).encode()
            return b"test reviewed audio"
        with tempfile.TemporaryDirectory() as root:
            out = Path(root)/"export"
            self.assertEqual(exporter.export_dataset("https://example.supabase.co", "admin", out, request), 1)
            manifest = (out/"manifest.jsonl").read_text()
            self.assertNotIn(uid, manifest)
            self.assertIn("مرحبا", manifest)
            self.assertEqual(len([p for p in calls if p.startswith("/storage/")]), 1)
            with self.assertRaises(ValueError): exporter.export_dataset("https://example.supabase.co", "admin", out, request)

    def test_exports_cannot_be_written_into_the_website_repository(self):
        with self.assertRaises(ValueError):
            exporter.export_dataset("https://example.supabase.co", "admin", exporter.ROOT / "private-voice-data" / "not-created", lambda p: b"[]")


if __name__ == "__main__": unittest.main()
