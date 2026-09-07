# Yalla Palestinian voice (experimental)

Yalla now has a locally generated audio pack covering all 80 lesson phrases and
the home-page word حبيبي. Select **Settings → Learning voice → Yalla Palestinian
voice · experimental**, try the samples, and save. This is the default for
visitors without an explicit saved voice choice; existing device-voice choices
are respected. A first-visit modal introduces Zaytoun, explains the experimental
voice, and offers a tap-to-play hello. Dismissal is remembered in this browser.
This preference stays on the device;
it does not change account progress or the database schema.

This is an integration and pronunciation layer built on
[hamdallah/Sofelia-TTS-82M](https://huggingface.co/hamdallah/Sofelia-TTS-82M), using
its supplied Eliaa voice. We did **not** train a new neural model or clone a user’s
voice. The underlying model is a Palestinian/Levantine fine-tune of
[hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M); both model cards
declare Apache-2.0. See [voice attribution](../public/audio/NOTICE.txt).

## Pronunciation and review

`scripts/voice/pronunciations.json` contains explicit phoneme inputs matched to
the lesson guides, including urban forms such as `ahweh` and `addeish`. These
are authored approximations, **not native-speaker-verified transcriptions**.
Palestinian pronunciation varies across communities. Gendered phrases use the
first form in the displayed guide. The frontend maps ħ/ʕ/ˤ to the model’s tokens
as documented by Sofelia. No automatic MSA grapheme-to-phoneme fallback is used
to invent pronunciations for new lessons.

`scripts/voice/review.json` records the input, file, duration, signal RMS, and
review status for every clip. Native review is still pending for every clip.
Listen in the Phrasebook, compare each phrase and stress pattern with the guide,
and edit the inputs before regenerating corrections. Playback/finite-signal
checks do not establish dialect accuracy. `recognition.json` records independent
Whisper transcriptions for all clips with their file hashes. Five speech anchors
must match within a limited character error rate before deployment. Expected
lesson text is never supplied as a hint to the recognizer. ASR is a regression
check for intelligible speech, not a native-speaker endorsement.

## Reference-based word corrections

Marhaba and keefak now use revised model phonemes and a per-word speed of 0.7,
based on the owner's supplied pronunciation examples. The deployed files remain
synthetic Eliaa clips; the original recordings stay outside the repository.
This changes pronunciation controls, not model weights or speaker identity.

Local comparison used [XLSR phoneme recognition](https://huggingface.co/facebook/wav2vec2-xlsr-53-espeak-cv-ft)
to compare candidate vowels/consonants and measured the active speech duration.
The selected clips' active speech spans are approximately 0.78 seconds for
marhaba and 0.56 seconds for keefak, versus 0.77 and 0.59 in the references.
These exclude leading/trailing silence. The automatic comparison still detects
differences in the pharyngeal consonant and final vowel; it does not establish an
exact match or replace the owner's listening review. The model input symbols are
synthesis controls, not a proposed change to the lesson's written transliteration.

`synthesis-settings.json` preserves each correction's speed and random seed.
To update selected clips while preserving every other file and its review record:

```sh
/tmp/yalla-voice-env/bin/python scripts/voice/generate.py --phrase 'مرحبا' --phrase 'كيفك؟'
/tmp/yalla-review-env/bin/python scripts/voice/recognize.py --phrase 'مرحبا' --phrase 'كيفك؟'
npm run voice:check
```

Selective recognition rejects stale results for any unselected clip. Generated
replacements keep `nativeReviewed: false` until their pronunciation is approved.

For **الله معك**, the owner requested a deeper opening vowel in Allah and
explicitly approved the existing ma'ak. The synthesis input now starts with
`ɑ` instead of `a`. Only the opening is replaced: a 10 ms crossfade into the
first /l/ joins the new prefix to the retained synthetic recording. All PCM from
0.70 seconds onward, including the entire ma'ak, is byte-identical to the prior
clip. `preserveTail` settings and the hash-pinned original in
`scripts/voice/fixtures/allah-maak-original.wav` make this edit reproducible;
`voice:check` verifies preservation on every build. The supplied human recording
is a private reference and is not included in the app. Phoneme recognition
detects the opening changing from /ɛ/ toward /a/; final listening review remains
with the owner.

## Static-noise fix

The first pack contained noise because the installed Kokoro loader silently
skipped checkpoint parameters. Sofelia stores modern parametrized weight-norm
names, while Kokoro 0.9.4 uses legacy `weight_g`/`weight_v` names. Its permissive
fallback accepted missing speech weights. `model_loader.py` now converts those
names, matches the checkpoint’s non-affine instance normalization, and strictly
loads every component. Any remaining missing, unexpected, or wrong-shaped
parameter aborts generation. Tests compare converted model output against a
trained-format module and verify invalid checkpoints fail.

All original clips have been regenerated. A retained broken-hello fixture ensures
the new signal check rejects the actual previous failure. Generation and CI
reject excessive sample-to-sample high-frequency energy; this guard catches
static but does not alone prove that speech is correct.

## Regenerate

Generation runs offline after the public model and Python packages are downloaded.
No paid API, account key, GPU server, or runtime inference is required. The model
weights stay outside Git. Use Python 3.11 and run from the repository root:

```sh
uv venv --python 3.11 /tmp/yalla-voice-env
uv pip install --python /tmp/yalla-voice-env/bin/python -r scripts/voice/requirements.txt
npm run voice:export
/tmp/yalla-voice-env/bin/python scripts/voice/generate.py
uv venv --python 3.11 /tmp/yalla-review-env
uv pip install --python /tmp/yalla-review-env/bin/python faster-whisper==1.2.1
/tmp/yalla-review-env/bin/python scripts/voice/recognize.py
npm run voice:check
/tmp/yalla-voice-env/bin/python -m unittest discover -s scripts/voice -p 'test_*.py'
```

The checkpoint is pinned to revision
`e1b729a4641311df2d78a22d81c42c10bfda64db`. The loader uses weights-only PyTorch
loading and the installed Kokoro implementation; no model-repository Python code
is executed. Generation validates full phrase coverage, supported phonemes,
finite samples, duration, non-silence, and static-noise energy, then writes 24 kHz mono PCM WAV files
and a manifest. Content-derived filenames prevent stale cached clips after edits.

All clips are served by GitHub Pages on demand. The browser downloads only the
clip selected by the learner; it does not download the model or the whole pack.
Missing/failed clips fall back to a device Arabic voice with a message. Replay,
navigation, audio-off, voice changes, and unmounting cancel previous playback.
The app’s existing same-origin media CSP covers these assets.
