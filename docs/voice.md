# Yalla Palestinian voice (experimental)

Yalla now has a locally generated audio pack covering all 80 lesson phrases and
the home-page word حبيبي. Select **Settings → Learning voice → Yalla Palestinian
voice · experimental**, try the samples, and save. The device voice remains the
default until the pack has been reviewed. This preference stays on the device;
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
checks do not establish dialect accuracy.

## Regenerate

Generation runs offline after the public model and Python packages are downloaded.
No paid API, account key, GPU server, or runtime inference is required. The model
weights stay outside Git. Use Python 3.11 and run from the repository root:

```sh
uv venv --python 3.11 /tmp/yalla-voice-env
uv pip install --python /tmp/yalla-voice-env/bin/python -r scripts/voice/requirements.txt
npm run voice:export
/tmp/yalla-voice-env/bin/python scripts/voice/generate.py
```

The checkpoint is pinned to revision
`e1b729a4641311df2d78a22d81c42c10bfda64db`. The loader uses weights-only PyTorch
loading and the installed Kokoro implementation; no model-repository Python code
is executed. Generation validates full phrase coverage, supported phonemes,
finite samples, duration, and non-silence, then writes 24 kHz mono PCM WAV files
and a manifest. Content-derived filenames prevent stale cached clips after edits.

All clips are served by GitHub Pages on demand. The browser downloads only the
clip selected by the learner; it does not download the model or the whole pack.
Missing/failed clips fall back to a device Arabic voice with a message. Replay,
navigation, audio-off, voice changes, and unmounting cancel previous playback.
The app’s existing same-origin media CSP covers these assets.
