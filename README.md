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
- Profile name, audio preference, daily goal settings, and confirmed progress reset.
- Responsive mobile navigation, keyboard focus management, and reduced-motion support.

Progress is stored in this browser's localStorage. There is no account system, cloud sync, or server. Clearing browser data removes progress. System Arabic speech synthesis is optional and depends on installed voices; these may pronounce standard Arabic rather than Palestinian dialect. Written pronunciation guides remain available.

## Project structure

- `src/main.tsx`: app navigation, dashboard, practice, phrasebook, progress, and lesson/settings dialogs.
- `src/data.ts`: starter lesson content and progress helpers.
- `src/moreLessons.ts`: additional lessons and unit metadata.
- `src/phraseTips.ts`: individual tips for the original phrases.
- `src/usePronunciation.ts`: replayable speech synthesis, asynchronous voice loading, and playback cleanup.
- `src/Mascot.tsx`: original SVG mascot and landscape artwork.
- `src/styles.css`: responsive visual design.
- `tests/app.spec.ts`: end-to-end browser coverage.

## Language references

Starter greetings and usage were checked against [Study in Palestine](https://studyinpalestine.org/palestinian-arabic-phrases/) and [Ramallah's visitor guide](https://ramallah.ps/public/files/archive/file/publications/welcomekit.pdf). Palestinian Arabic varies across communities; this introductory course uses common conversational forms and simplified transliteration. A native Palestinian teacher should review the full curriculum before it is expanded into a formal course.

The brand, mascot, and illustrations are original to this app. Fonts load from Google Fonts, with local sans-serif fallbacks.

The expanded course keeps the original lesson IDs and storage format. Existing XP, completed lessons, favorites, and earned starter-course achievements are preserved.
