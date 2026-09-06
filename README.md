# Yalla! — Palestinian Arabic, a little every day

A responsive React + TypeScript web app for learning everyday Palestinian Levantine Arabic. Meet Zaytoun, an original olive-bird mascot, and work through sixteen five-phrase lessons across four units.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:5173.

```sh
npm run build   # Type-check and create the production build in dist/
npm run preview # Serve the production build locally
npm test        # Run Chromium browser tests
```

Before the first browser test run, install Chromium with `npx playwright install chromium`.

## Features

- Guided learning path with lesson prerequisites and a review for every unit.
- Learn Arabic script, transliteration, English meaning, and phrase-specific tips and gender/usage notes.
- Five-question quizzes with immediate feedback, an 80% passing threshold, and retries.
- 30 XP per new lesson; 10 XP for a successful review or practice session.
- Daily goals, local-calendar-day streaks, levels, weekly activity, and seven achievements.
- Searchable 80-phrase collection with saved favorites.
- Practice individual topics or a mixed review of learned phrases.
- Email/password signup, verification, sign-in, password reset, and private cloud progress.
- Guest progress import, failed-save recovery, and explicit cross-device conflict resolution.
- Profile name, audio preference, daily goal settings, and confirmed progress reset.
- Responsive mobile navigation, keyboard focus management, and reduced-motion support.

Email/password accounts save names, XP, and learning progress in Supabase. Guest progress remains in this browser; signed-in learners can explicitly import it from Settings. Passwords are sent over HTTPS and hashed by Supabase Auth. See [account setup and security](docs/accounts.md). New visitors meet Zaytoun in a first-visit welcome, and the experimental Palestinian AI voice is the default. Settings includes this voice covering all 80 phrases, with samples and replayable audio hosted on GitHub Pages. It uses Sofelia’s Eliaa voice with Yalla pronunciation inputs and still needs native-speaker review. Device Arabic voices remain available. See [voice generation and review](docs/voice.md).

## Project structure

- `src/main.tsx`: app navigation, dashboard, practice, phrasebook, progress, and lesson/settings dialogs.
- `src/data.ts`: starter lesson content and progress helpers.
- `src/moreLessons.ts`: additional lessons and unit metadata.
- `src/phraseTips.ts`: individual tips for the original phrases.
- `src/usePronunciation.ts`: generated audio playback, cancellation, and fallback to `src/useSystemPronunciation.ts`.
- `src/Mascot.tsx`: original SVG mascot and landscape artwork.
- `src/styles.css`: responsive visual design.
- `tests/app.spec.ts`: end-to-end browser coverage.

## Language references

Starter greetings and usage were checked against [Study in Palestine](https://studyinpalestine.org/palestinian-arabic-phrases/) and [Ramallah's visitor guide](https://ramallah.ps/public/files/archive/file/publications/welcomekit.pdf). Palestinian Arabic varies across communities; this introductory course uses common conversational forms and simplified transliteration. A native Palestinian teacher should review the full curriculum before it is expanded into a formal course.

The brand, mascot, and illustrations are original to this app. Fonts load from Google Fonts, with local sans-serif fallbacks.

The expanded course keeps the original lesson IDs and storage format. Existing XP, completed lessons, favorites, and earned starter-course achievements are preserved.

## GitHub Pages deployment

The deployment workflow in `.github/workflows/deploy.yml` tests and builds the app before publishing it. Pushes to `main` deploy automatically once GitHub Pages is enabled. You can also start it manually from the Actions tab.

GitHub must allow Pages for this repository. A private repository requires an eligible paid GitHub plan; alternatively, its owner can choose to make the source repository public. In **Settings → Pages**, select **GitHub Actions** as the source.

The target URL is https://jonathanshomali.github.io/arabic-app/.

To verify that deployment locally:

```sh
npm run build:pages
npm run preview -- --mode github-pages
```

Open http://localhost:4173/arabic-app/. The `github-pages` mode prefixes built asset URLs with `/arabic-app/`; `npm run dev` and ordinary builds continue to work at `/`.

Signed-in progress syncs through Supabase across devices. Guest progress is stored per browser origin: localhost and the public website have separate guest data. Importing guest progress from Settings combines it with the signed-in account on that origin.

The native-speaker recording pilot adds automatic, clearly disclosed voice contributions from lesson cards and the Phrasebook. Participants sign in, record up to 20 seconds, replay or retry uploads, and delete submissions in Settings. See [recording setup, review, and training-dataset export](docs/recordings.md).
