import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Coffee,
  Flame,
  Hand,
  Heart,
  Leaf,
  LockKeyhole,
  Map,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  Trophy,
  Volume2,
  X,
  Zap,
  Bookmark,
  RotateCcw,
  Smile,
  Utensils,
  CircleHelp,
  CheckCircle2,
} from "lucide-react";
import { Mascot, Landscape } from "./Mascot";
import {
  lessons,
  allPhrases,
  emptyProgress,
  loadProgress,
  getStreak,
  localDate,
  type Lesson,
  type Phrase,
  type Progress,
} from "./data";
import { laterUnits } from "./moreLessons";
import { usePronunciation } from "./usePronunciation";
import "./styles.css";

type Page = "Learn" | "Practice" | "Phrasebook" | "My progress";
const icons = {
  hand: Hand,
  chat: MessageCircle,
  smile: Smile,
  spark: Sparkles,
  coffee: Coffee,
  food: Utensils,
  map: Map,
  heart: Heart,
};
const nav = [
  { label: "Learn" as Page, icon: Map },
  { label: "Practice" as Page, icon: Zap },
  { label: "Phrasebook" as Page, icon: BookOpen },
  { label: "My progress" as Page, icon: ChartNoAxesCombined },
];
function App() {
  const [page, setPage] = useState<Page>("Learn");
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [session, setSession] = useState<{
    lesson: Lesson;
    practice: boolean;
  } | null>(null);
  const [settings, setSettings] = useState(false);
  const [about, setAbout] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All phrases");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("yalla-progress", JSON.stringify(progress));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [progress]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const todayXP = progress.activity[localDate()] || 0;
  const next = lessons.find((l) => !progress.completed.includes(l.id));
  const streak = getStreak(progress.activity);
  const level = 1 + Math.floor(progress.xp / 100);
  const unlocked = (id: number) =>
    id === 0 || progress.completed.includes(id - 1);
  const {
    speak,
    stop: stopAudio,
    speaking,
  } = usePronunciation(progress.sound, setToast);
  useEffect(() => {
    stopAudio();
  }, [page, session, stopAudio]);
  function complete(lesson: Lesson, practice: boolean, score: number) {
    const xp = practice ? 10 : 30;
    setProgress((p) => ({
      ...p,
      xp: p.xp + xp,
      completed: practice
        ? p.completed
        : [...new Set([...p.completed, lesson.id])],
      practices: p.practices + (practice ? 1 : 0),
      activity: {
        ...p.activity,
        [localDate()]: (p.activity[localDate()] || 0) + xp,
      },
    }));
    return { xp, score };
  }
  function save(ar: string) {
    setProgress((p) => ({
      ...p,
      saved: p.saved.includes(ar)
        ? p.saved.filter((s) => s !== ar)
        : [...p.saved, ar],
    }));
  }
  function start(lesson: Lesson, practice = false) {
    setSession({
      lesson,
      practice: practice || progress.completed.includes(lesson.id),
    });
  }
  const phrases = allPhrases.filter(
    (p) =>
      (filter !== "Saved" || progress.saved.includes(p.ar)) &&
      (filter === "All phrases" || filter === "Saved" || p.lesson === filter) &&
      `${p.ar} ${p.latin} ${p.en}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Learn");
          }}
          aria-label="Yalla home"
        >
          <span className="brand-symbol">
            <Leaf size={23} />
          </span>
          yalla<span className="brand-dot">!</span>
        </a>
        <div className="brand-caption">
          A little Arabic. A lot of connection.
        </div>
        <nav aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => setPage(label)}
            >
              <Icon size={21} />
              <span>{label}</span>
              {label === "Learn" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="tiny-leaves">
            <Leaf size={23} />
            <Sparkles size={15} />
          </div>
          <h4>
            Small steps.
            <br />
            Real conversations.
          </h4>
          <p>
            Five minutes today can open
            <br />a whole new world.
          </p>
          <span className="arabic" lang="ar" dir="rtl">
            شوي شوي
          </span>
          <small>shway shway · little by little</small>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setSettings(true)}>
            <Settings size={19} /> Settings
          </button>
          <button onClick={() => setAbout(true)}>
            <CircleHelp size={19} /> About Yalla
          </button>
          <div className="made-with">
            Made with <Heart size={12} /> & a little olive oil
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="course-label">
            <span className="flag" aria-label="Palestinian flag">
              <i />
            </span>
            <span>
              Palestinian Arabic<small>Levantine dialect</small>
            </span>
            <ChevronRight size={15} />
          </div>
          <div className="top-stats">
            <span title="Your current learning streak">
              <Flame size={21} />
              <b>{streak}</b>
              <span className="stat-label">day streak</span>
            </span>
            <span title="Total experience points">
              <Zap size={20} />
              <b>{progress.xp}</b>
              <span className="stat-label">XP</span>
            </span>
            <button
              className="avatar"
              onClick={() => setSettings(true)}
              aria-label="Open profile settings"
            >
              {progress.name ? progress.name[0].toUpperCase() : "Y"}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR EVERYDAY ADVENTURE</div>
              <h1>
                {page === "Learn"
                  ? `Ahlan${progress.name ? `, ${progress.name}` : ""}! Let’s learn a little.`
                  : page === "Practice"
                    ? "A little practice goes a long way."
                    : page === "Phrasebook"
                      ? "Good words to have on hand."
                      : "Look how far you’ve come."}{" "}
                <span>{page === "Learn" ? "👋" : ""}</span>
              </h1>
              <p>
                {page === "Learn"
                  ? "Connect with the language. Feel closer to the culture."
                  : page === "Practice"
                    ? "Keep your Arabic fresh, one small conversation at a time."
                    : page === "Phrasebook"
                      ? "Everyday Palestinian Arabic, ready when you need it."
                      : "Every word is a step toward a real conversation."}
              </p>
            </div>
            {page === "Learn" && (
              <span className="level-pill">
                <Leaf size={15} /> Level {level} ·{" "}
                {level < 3 ? "Curious beginner" : "Growing speaker"}
              </span>
            )}
          </div>
          {storageError && (
            <div className="notice">
              Your browser couldn’t save progress. Keep this tab open to
              preserve this session.
            </div>
          )}
          <div className="content-grid">
            <div className="main-column">
              {page === "Learn" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="tag">
                        A LANGUAGE THAT FEELS LIKE HOME
                      </span>
                      <h2>
                        Big connections.
                        <br />
                        Little conversations.
                      </h2>
                      <p>
                        Learn the Arabic you’ll actually hear.
                        <br />
                        From your first <em>marhaba</em> to a chat over coffee.
                      </p>
                      <button
                        className="primary"
                        onClick={() => start(next || lessons[0])}
                      >
                        {progress.completed.length
                          ? "Continue learning"
                          : "Let’s get started"}
                        <ArrowRight size={17} />
                      </button>
                      <div className="hero-foot">
                        <span className="mini-dot" /> 5-minute lessons{" "}
                        <span>·</span> Your own pace
                      </div>
                    </div>
                    <Landscape />
                    <div className="mascot-greeting">
                      <span className="greeting-arabic" lang="ar" dir="rtl">
                        أهلين!
                      </span>
                      <span className="greeting-latin">ahleen!</span>
                    </div>
                    <Mascot className="hero-mascot" />
                  </section>
                  <div className="section-heading">
                    <h2>Your learning path</h2>
                    <span>
                      {progress.completed.length} of {lessons.length} lessons
                      complete
                    </span>
                  </div>
                  <section className="unit">
                    <div className="unit-header">
                      <div className="unit-icon">
                        <SproutIcon />
                      </div>
                      <div>
                        <span className="eyebrow">
                          UNIT 1 · THE FIRST HELLO
                        </span>
                        <h3>Every connection starts somewhere.</h3>
                      </div>
                      <button
                        className="guide-button"
                        onClick={() => setAbout(true)}
                      >
                        <BookOpen size={16} />
                        <span>Guidebook</span>
                      </button>
                    </div>
                    <div className="lesson-path">
                      {lessons.slice(0, 4).map((l, i) => {
                        const done = progress.completed.includes(l.id),
                          open = unlocked(l.id),
                          Icon = icons[l.icon as keyof typeof icons];
                        return (
                          <div
                            className={`lesson-row ${done ? "done" : open ? "current" : "locked"}`}
                            key={l.id}
                          >
                            <div className="node-wrap">
                              <button
                                className="lesson-node"
                                disabled={!open}
                                onClick={() => start(l)}
                                aria-label={`${done ? "Review" : open ? "Start" : "Locked"}: ${l.title}`}
                              >
                                {done ? (
                                  <Check size={27} />
                                ) : open ? (
                                  <Icon size={28} />
                                ) : (
                                  <LockKeyhole size={23} />
                                )}
                              </button>
                              {i < 3 && <span className="path-line" />}
                            </div>
                            <div className="lesson-info">
                              <div>
                                {open && !done && (
                                  <span className="start-label">
                                    {progress.completed.length
                                      ? "UP NEXT"
                                      : "START HERE"}
                                  </span>
                                )}
                                <h4>{l.title}</h4>
                                <p>{l.subtitle}</p>
                                <span className="lesson-meta">
                                  5 words <span>·</span> 5 min{" "}
                                  {done && (
                                    <span className="completed-label">
                                      · Completed
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                            {open ? (
                              <button
                                className={`lesson-cta ${done ? "review" : ""}`}
                                onClick={() => start(l)}
                              >
                                {done ? "Review" : "Start lesson"}
                                <ArrowRight size={16} />
                              </button>
                            ) : (
                              <span className="locked-label">
                                Lesson {i + 1}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="unit-test">
                      <div className="test-icon">
                        <Trophy size={23} />
                      </div>
                      <div>
                        <h4>First hello, big milestone</h4>
                        <p>
                          {progress.completed.filter((id) => id < 4).length ===
                          4
                            ? "You did it! Put your new words to the test."
                            : "Complete these 4 lessons to unlock a unit review."}
                        </p>
                      </div>
                      <button
                        disabled={
                          !lessons
                            .slice(0, 4)
                            .every((l) => progress.completed.includes(l.id))
                        }
                        aria-label="Start unit one review"
                        onClick={() =>
                          start(
                            {
                              ...lessons[0],
                              title: "The first hello · Unit review",
                              phrases: lessons
                                .slice(0, 4)
                                .flatMap((l) => l.phrases),
                            },
                            true,
                          )
                        }
                      >
                        {lessons
                          .slice(0, 4)
                          .every((l) => progress.completed.includes(l.id)) ? (
                          <ArrowRight size={20} />
                        ) : (
                          <LockKeyhole size={18} />
                        )}
                      </button>
                    </div>
                  </section>
                  {laterUnits.map((unit) => {
                    const unitLessons = lessons.slice(unit.start, unit.end);
                    const UnitIcon = icons[unit.icon as keyof typeof icons];
                    const finished = unitLessons.every((l) =>
                      progress.completed.includes(l.id),
                    );
                    return (
                      <section
                        className="unit second-unit"
                        key={unit.id}
                        aria-label={`Unit ${unit.id}: ${unit.title}`}
                      >
                        <div className="unit-header">
                          <div className="unit-icon warm">
                            <UnitIcon size={23} />
                          </div>
                          <div>
                            <span className="eyebrow">
                              UNIT {unit.id} · {unit.title.toUpperCase()}
                            </span>
                            <h3>{unit.subtitle}</h3>
                          </div>
                          {unit.id > 2 && (
                            <span className="new-unit-badge">NEW</span>
                          )}
                          {!unlocked(unit.start) && <LockKeyhole size={19} />}
                        </div>
                        <div className="unit-two-lessons">
                          {unitLessons.map((l) => {
                            const Icon = icons[l.icon as keyof typeof icons];
                            const done = progress.completed.includes(l.id);
                            return (
                              <button
                                key={l.id}
                                disabled={!unlocked(l.id)}
                                className={
                                  unlocked(l.id) && !done ? "next-lesson" : ""
                                }
                                onClick={() => start(l)}
                                aria-label={`${done ? "Review" : unlocked(l.id) ? "Start" : "Locked"}: ${l.title}`}
                              >
                                <Icon size={22} />
                                <span>
                                  {l.title}
                                  <small>
                                    {unlocked(l.id) && !done
                                      ? "Up next · "
                                      : ""}
                                    {l.phrases.length} phrases · 5 min
                                  </small>
                                </span>
                                {done ? (
                                  <Check size={18} />
                                ) : unlocked(l.id) ? (
                                  <ArrowRight size={18} />
                                ) : (
                                  <LockKeyhole size={15} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="unit-test">
                          <div className="test-icon">
                            <Trophy size={23} />
                          </div>
                          <div>
                            <h4>{unit.title} · Unit review</h4>
                            <p>
                              {finished
                                ? "Bring your new words together. Earn 10 XP."
                                : "Complete these 4 lessons to unlock a unit review."}
                            </p>
                          </div>
                          <button
                            disabled={!finished}
                            aria-label={`Start unit ${unit.id} review`}
                            onClick={() =>
                              start(
                                {
                                  ...unitLessons[0],
                                  title: `${unit.title} · Unit review`,
                                  phrases: unitLessons.flatMap(
                                    (l) => l.phrases,
                                  ),
                                },
                                true,
                              )
                            }
                          >
                            {finished ? (
                              <ArrowRight size={20} />
                            ) : (
                              <LockKeyhole size={18} />
                            )}
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </>
              )}
              {page === "Practice" && (
                <>
                  <section className="practice-hero">
                    <Mascot happy />
                    <div>
                      <span className="eyebrow">MAKE IT STICK</span>
                      <h2>
                        A little repetition.
                        <br />A lot more confidence.
                      </h2>
                      <p>
                        Review useful phrases with a quick, five-question quiz.
                        Earn 10 XP for every session.
                      </p>
                      <button
                        className="primary"
                        onClick={() =>
                          start(
                            {
                              ...lessons[0],
                              title: "Daily practice",
                              phrases: lessons
                                .filter(
                                  (l) =>
                                    progress.completed.includes(l.id) ||
                                    l.id === 0,
                                )
                                .flatMap((l) => l.phrases),
                            },
                            true,
                          )
                        }
                      >
                        Start daily practice
                        <Zap size={17} />
                      </button>
                    </div>
                  </section>
                  <div className="section-heading">
                    <h2>Practice by topic</h2>
                    <span>No pressure. Just progress.</span>
                  </div>
                  <div className="topic-grid">
                    {lessons.map((l) => {
                      const Icon = icons[l.icon as keyof typeof icons];
                      return (
                        <button
                          key={l.id}
                          className="topic-card"
                          onClick={() => start(l, true)}
                        >
                          <span className="topic-icon">
                            <Icon size={25} />
                          </span>
                          <h3>{l.title}</h3>
                          <p>{l.subtitle}</p>
                          <span className="topic-bottom">
                            5 questions · +10 XP
                            <ArrowRight size={17} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {page === "Phrasebook" && (
                <>
                  <div className="search-box">
                    <Search size={20} />
                    <input
                      aria-label="Search phrases"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a word, a phrase, a little connection…"
                    />
                  </div>
                  <div className="filter-tabs">
                    {[
                      "All phrases",
                      "Saved",
                      ...lessons.map((l) => l.title),
                    ].map((f) => (
                      <button
                        className={filter === f ? "selected" : ""}
                        key={f}
                        onClick={() => setFilter(f)}
                      >
                        {f === "Saved" && <Bookmark size={14} />} {f}
                      </button>
                    ))}
                  </div>
                  <div className="phrase-count">
                    {phrases.length} phrases{" "}
                    <span>· Tap the bookmark to save a favorite</span>
                  </div>
                  <div className="phrase-list">
                    {phrases.map((p) => (
                      <article className="phrase-card" key={p.ar}>
                        <div>
                          <span className="phrase-topic">{p.lesson}</span>
                          <h3>{p.en}</h3>
                          <p>{p.latin}</p>
                          {p.note && <small>{p.note}</small>}
                        </div>
                        <div className="phrase-arabic">
                          <span lang="ar" dir="rtl">
                            {p.ar}
                          </span>
                          <div>
                            <button
                              onClick={() => speak(p)}
                              aria-label={`Hear ${p.en}`}
                              aria-pressed={speaking === p.ar}
                            >
                              <Volume2 size={18} />
                            </button>
                            <button
                              className={
                                progress.saved.includes(p.ar)
                                  ? "bookmarked"
                                  : ""
                              }
                              onClick={() => save(p.ar)}
                              aria-label={`${progress.saved.includes(p.ar) ? "Unsave" : "Save"} ${p.en}`}
                            >
                              <Bookmark
                                size={18}
                                fill={
                                  progress.saved.includes(p.ar)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!phrases.length && (
                      <div className="empty-state">
                        <BookOpen size={36} />
                        <h3>
                          {filter === "Saved"
                            ? "Your favorite words belong here."
                            : "No phrases found."}
                        </h3>
                        <p>
                          {filter === "Saved"
                            ? "Bookmark a phrase to keep it close."
                            : "Try a different word or topic."}
                        </p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setFilter("All phrases");
                            setQuery("");
                          }}
                        >
                          Browse all phrases <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="language-note">
                    Pronunciation varies across Palestinian communities. Browser
                    audio, when available, uses a system Arabic voice and may
                    differ from Palestinian pronunciation. Follow the written
                    pronunciation guide for dialect forms.
                  </p>
                </>
              )}
              {page === "My progress" && (
                <>
                  <div className="progress-summary">
                    {[
                      { icon: Zap, value: progress.xp, label: "Total XP" },
                      { icon: Flame, value: streak, label: "Day streak" },
                      {
                        icon: BookOpen,
                        value: lessons
                          .filter((l) => progress.completed.includes(l.id))
                          .reduce((sum, l) => sum + l.phrases.length, 0),
                        label: "Words learned",
                      },
                    ].map(({ icon: Icon, value, label }) => (
                      <div key={label}>
                        <Icon size={23} />
                        <strong>{value}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <section className="card activity-card">
                    <div className="section-heading">
                      <h2>Your week in words</h2>
                      <span>Daily XP</span>
                    </div>
                    <div className="activity-chart">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - 6 + i);
                        const xp = progress.activity[localDate(d)] || 0;
                        return (
                          <div key={i}>
                            <span>{xp}</span>
                            <div className="bar-track">
                              <div
                                style={{
                                  height: `${Math.min(100, (xp / Math.max(progress.goal, ...Object.values(progress.activity), 1)) * 100)}%`,
                                }}
                              />
                            </div>
                            <small>
                              {d.toLocaleDateString("en", { weekday: "short" })}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <div className="section-heading">
                    <h2>Little wins, well earned</h2>
                  </div>
                  <div className="achievement-grid">
                    {[
                      {
                        name: "The first hello",
                        desc: "Complete your first lesson",
                        icon: Hand,
                        earned: progress.completed.length > 0,
                      },
                      {
                        name: "Finding your rhythm",
                        desc: "Learn 3 days in a row",
                        icon: Flame,
                        earned: streak >= 3,
                      },
                      {
                        name: "Rooted in the basics",
                        desc: "Finish all 4 lessons in Unit 1",
                        icon: Leaf,
                        earned: lessons
                          .slice(0, 4)
                          .every((l) => progress.completed.includes(l.id)),
                      },
                      {
                        name: "A hundred little steps",
                        desc: "Earn 100 XP",
                        icon: Star,
                        earned: progress.xp >= 100,
                      },
                      {
                        name: "Keep it fresh",
                        desc: "Complete 5 practice sessions",
                        icon: Zap,
                        earned: progress.practices >= 5,
                      },
                      {
                        name: "Out into the world",
                        desc: "Complete the first 8 lessons",
                        icon: Trophy,
                        earned: lessons
                          .slice(0, 8)
                          .every((l) => progress.completed.includes(l.id)),
                      },
                      {
                        name: "A world of conversation",
                        desc: `Complete all ${lessons.length} lessons`,
                        icon: MessageCircle,
                        earned: lessons.every((l) =>
                          progress.completed.includes(l.id),
                        ),
                      },
                    ].map(({ name, desc, icon: Icon, earned }) => (
                      <div
                        className={`achievement ${earned ? "earned" : ""}`}
                        key={name}
                      >
                        <div>
                          <Icon size={27} />
                          {earned && <CheckCircle2 size={15} />}
                        </div>
                        <h3>{name}</h3>
                        <p>{desc}</p>
                        <span>{earned ? "Earned!" : "Keep growing"}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <aside className="right-column">
              <section className="card daily-goal">
                <div className="card-heading">
                  <h3>Your daily little win</h3>
                  <Target size={20} />
                </div>
                <p>A few minutes. One step closer.</p>
                <div className="goal-numbers">
                  <strong>
                    {todayXP}
                    <span> / {progress.goal} XP</span>
                  </strong>
                  <span>
                    {Math.round(Math.min(100, (todayXP / progress.goal) * 100))}
                    %
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    style={{
                      width: `${Math.min(100, (todayXP / progress.goal) * 100)}%`,
                    }}
                  />
                </div>
                <div className="goal-foot">
                  {todayXP >= progress.goal ? (
                    <>
                      <Check size={14} /> Daily goal complete. Nice work!
                    </>
                  ) : (
                    <>
                      <Zap size={14} /> {Math.max(0, progress.goal - todayXP)}{" "}
                      XP to your daily goal
                    </>
                  )}
                </div>
              </section>
              <section className="zaytoun-card">
                <div className="zaytoun-header">
                  <span>YOUR LITTLE CHEERLEADER</span>
                  <Sparkles size={17} />
                </div>
                <div className="zaytoun-content">
                  <Mascot happy />
                  <div>
                    <h3>Marhaba, friend!</h3>
                    <p>
                      I’m Zaytoun. Let’s turn
                      <br />
                      “I wish I could” into
                      <br />
                      “I just did.”
                    </p>
                  </div>
                </div>
                <div className="zaytoun-signoff">
                  A little courage looks good on you. <Heart size={13} />
                </div>
              </section>
              <section className="card word-card">
                <div className="card-heading">
                  <span className="eyebrow">A WORD TO TAKE WITH YOU</span>
                  <span className="word-leaf">
                    <Leaf size={18} />
                  </span>
                </div>
                <div className="daily-word" lang="ar" dir="rtl">
                  حبيبي
                </div>
                <div className="word-pronunciation">
                  habibi{" "}
                  <button
                    onClick={() =>
                      speak({ ar: "حبيبي", latin: "habibi", en: "My dear" })
                    }
                    aria-label="Hear habibi"
                    aria-pressed={speaking === "حبيبي"}
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
                <h4>My dear. My loved one.</h4>
                <p>
                  A little word with a whole lot of warmth. For a friend, a
                  loved one, or someone who just made your day.
                </p>
                <span className="word-note">
                  To a woman, say <b>habibti</b> · <bdi lang="ar">حبيبتي</bdi>
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    setPage("Phrasebook");
                    setQuery("");
                    setFilter("All phrases");
                  }}
                >
                  Explore the phrasebook <ArrowRight size={15} />
                </button>
              </section>
              <div className="culture-note">
                <span>🌿</span>
                <p>
                  More than words.
                  <br />
                  <b>A way to feel closer.</b>
                </p>
                <div className="tatreez" aria-hidden="true">
                  ✧ ⨯ ✧ ⨯ ✧ ⨯ ✧ ⨯ ✧
                </div>
              </div>
            </aside>
          </div>
          <footer>
            <span>Rooted in Palestine. Made for connection.</span>
            <span lang="ar" dir="rtl">
              يلا نحكي عربي
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={page === label ? "active" : ""}
            onClick={() => setPage(label)}
          >
            <Icon size={21} />
            <span>{label === "My progress" ? "Progress" : label}</span>
          </button>
        ))}
      </nav>
      {session && (
        <LessonModal
          lesson={session.lesson}
          practice={session.practice}
          onClose={() => setSession(null)}
          onComplete={complete}
          speak={speak}
          speaking={speaking}
          stopAudio={stopAudio}
        />
      )}
      {settings && (
        <SettingsModal
          progress={progress}
          setProgress={setProgress}
          onClose={() => setSettings(false)}
        />
      )}
      {about && (
        <Modal
          title="Ahlan w sahlan. Welcome to Yalla!"
          onClose={() => setAbout(false)}
        >
          <div className="about-content">
            <Mascot happy />
            <p>
              Learn everyday Palestinian Arabic through short lessons, useful
              phrases, and plenty of small wins.
            </p>
            <h3>How your journey works</h3>
            <p>
              Learn five phrases, then take a quiz. Score at least 80% to
              complete a lesson, earn 30 XP, and unlock the next one. Reviews
              and practice earn 10 XP. Your progress is saved in this browser.
            </p>
            <h3>Arabic, the way it’s spoken</h3>
            <p>
              We focus on Palestinian Levantine Arabic. You’ll see Arabic
              script, a readable pronunciation guide, and notes about gender and
              usage. Pronunciation differs across communities; the guide uses
              common conversational forms.
            </p>
            <h3>A note on audio</h3>
            <p>
              Audio needs an Arabic voice installed in your browser or operating
              system. System voices may use standard Arabic pronunciation rather
              than Palestinian dialect.
            </p>
            <p className="sources">
              Language references:{" "}
              <a
                href="https://studyinpalestine.org/palestinian-arabic-phrases/"
                target="_blank"
                rel="noreferrer"
              >
                Study in Palestine
              </a>{" "}
              and{" "}
              <a
                href="https://ramallah.ps/public/files/archive/file/publications/welcomekit.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Ramallah’s visitor guide
              </a>
              .
            </p>
            <button className="primary" onClick={() => setAbout(false)}>
              Yalla, let’s go <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function SproutIcon() {
  return <Leaf size={24} />;
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, a[href], [tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", fn);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close dialog">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function LessonModal({
  lesson,
  practice,
  onClose,
  onComplete,
  speak,
  speaking,
  stopAudio,
}: {
  lesson: Lesson;
  practice: boolean;
  onClose: () => void;
  onComplete: (
    l: Lesson,
    p: boolean,
    s: number,
  ) => { xp: number; score: number };
  speak: (p: Phrase) => void;
  speaking: string | null;
  stopAudio: () => void;
}) {
  const [stage, setStage] = useState<"learn" | "quiz" | "result">(
    practice ? "quiz" : "learn",
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [earned, setEarned] = useState(0);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [questions, setQuestions] = useState(() =>
    shuffle(lesson.phrases)
      .slice(0, 5)
      .map((p) => ({
        phrase: p,
        options: shuffle([
          p.en,
          ...shuffle(allPhrases.filter((x) => x.en !== p.en))
            .slice(0, 3)
            .map((x) => x.en),
        ]),
      })),
  );
  const current =
    stage === "learn" ? lesson.phrases[index] : questions[index]?.phrase;
  const total = stage === "learn" ? lesson.phrases.length : questions.length;
  useEffect(() => {
    stopAudio();
  }, [index, stage, stopAudio]);
  function advance() {
    if (!checked) {
      setChecked(true);
      if (selected === current.en) setScore((s) => s + 1);
      return;
    }
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelected(null);
      setChecked(false);
    } else {
      if (score / questions.length >= 0.8)
        setEarned(onComplete(lesson, practice, score).xp);
      setStage("result");
    }
  }
  function retry() {
    setQuestions(
      shuffle(lesson.phrases)
        .slice(0, 5)
        .map((p) => ({
          phrase: p,
          options: shuffle([
            p.en,
            ...shuffle(allPhrases.filter((x) => x.en !== p.en))
              .slice(0, 3)
              .map((x) => x.en),
          ]),
        })),
    );
    setIndex(0);
    setSelected(null);
    setChecked(false);
    setScore(0);
    setEarned(0);
    setStage("quiz");
  }
  return (
    <Modal
      title={lesson.title}
      onClose={() => (stage === "result" ? onClose() : setExitConfirm(true))}
    >
      {exitConfirm ? (
        <div className="exit-confirm">
          <h2>Pause this lesson?</h2>
          <p>
            Your completed lessons are saved. This attempt will start over when
            you return.
          </p>
          <button className="primary" onClick={() => setExitConfirm(false)}>
            Keep learning
          </button>
          <button className="secondary" onClick={onClose}>
            Leave lesson
          </button>
        </div>
      ) : stage === "result" ? (
        <div className="result">
          <Mascot happy={earned > 0} />
          <span className="eyebrow">
            {earned
              ? "A LITTLE WIN WORTH CELEBRATING"
              : "EVERY TRY IS A STEP FORWARD"}
          </span>
          <h2>
            {earned ? "Look at you, speaking Arabic!" : "You’re getting there."}
          </h2>
          <p>
            {earned
              ? "Another little conversation is waiting for you."
              : "Get 4 out of 5 right to complete this lesson. Let’s give it another go."}
          </p>
          <div className="result-stats">
            <div>
              <Target />
              <strong>{Math.round((score / questions.length) * 100)}%</strong>
              <span>Accuracy</span>
            </div>
            <div>
              <Zap />
              <strong>+{earned}</strong>
              <span>XP earned</span>
            </div>
          </div>
          <button className="primary" onClick={earned ? onClose : retry}>
            {earned ? "Back to my journey" : "Try again"}
            <ArrowRight size={17} />
          </button>
          {!earned && (
            <button
              className="text-button"
              onClick={() => {
                setStage("learn");
                setIndex(0);
                setScore(0);
                setSelected(null);
                setChecked(false);
              }}
            >
              Review the phrases first
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="lesson-progress">
            <span>
              {stage === "learn"
                ? "MEET YOUR NEW WORDS"
                : "A LITTLE KNOWLEDGE CHECK"}
            </span>
            <span>
              {index + 1} / {total}
            </span>
          </div>
          <div className="progress-track">
            <div
              style={{
                width: `${((index + (checked ? 1 : 0)) / total) * 100}%`,
              }}
            />
          </div>
          {stage === "learn" ? (
            <div className="learn-card">
              <span className="lesson-card-label">
                Listen. Say it. Make it yours.
              </span>
              <button
                className="big-audio"
                onClick={() => speak(current)}
                aria-label={`Hear ${current.en}`}
                aria-pressed={speaking === current.ar}
              >
                <Volume2 size={24} />
              </button>
              <div className="learn-arabic" lang="ar" dir="rtl">
                {current.ar}
              </div>
              <div className="learn-latin">{current.latin}</div>
              <h2>{current.en}</h2>
              {current.note && <p className="phrase-note">{current.note}</p>}
              <div className="lesson-tip" aria-live="polite" aria-atomic="true">
                <Leaf size={20} />
                <div>
                  <span className="tip-label">
                    A LITTLE TIP FOR THIS PHRASE
                  </span>
                  <p>
                    {current.tip ||
                      current.note ||
                      `Try saying “${current.latin}” aloud, then recall its meaning: ${current.en.toLowerCase()}.`}
                  </p>
                </div>
              </div>
              <button
                className="primary"
                onClick={() => {
                  if (index < lesson.phrases.length - 1) setIndex(index + 1);
                  else {
                    setStage("quiz");
                    setIndex(0);
                  }
                }}
              >
                {index < lesson.phrases.length - 1
                  ? "Next phrase"
                  : "Let’s try a little quiz"}
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <div className="quiz">
              <h2>What does this mean?</h2>
              <div className="quiz-phrase">
                <button
                  onClick={() => speak(current)}
                  aria-label="Hear question phrase"
                  aria-pressed={speaking === current.ar}
                >
                  <Volume2 size={22} />
                </button>
                <div>
                  <span lang="ar" dir="rtl">
                    {current.ar}
                  </span>
                  <p>{current.latin}</p>
                </div>
              </div>
              <div className="answer-options">
                {questions[index].options.map((o, i) => (
                  <button
                    key={o}
                    disabled={checked}
                    className={`${selected === o ? "selected" : ""} ${checked && o === current.en ? "correct" : ""} ${checked && selected === o && o !== current.en ? "incorrect" : ""}`}
                    onClick={() => setSelected(o)}
                  >
                    <span>{i + 1}</span>
                    {o}
                    {checked && o === current.en && <Check size={19} />}
                  </button>
                ))}
              </div>
              {checked && (
                <div
                  role="status"
                  className={`answer-feedback ${selected === current.en ? "positive" : "negative"}`}
                >
                  <strong>
                    {selected === current.en
                      ? "Sah! That’s right."
                      : "Almost. You’re still learning!"}
                  </strong>
                  <span>
                    {selected === current.en
                      ? "One more word to make your own."
                      : `“${current.latin}” means “${current.en}.”`}
                  </span>
                </div>
              )}
              <button
                className="primary"
                disabled={!selected}
                onClick={advance}
              >
                {!checked
                  ? "Check answer"
                  : index === questions.length - 1
                    ? "See how you did"
                    : "Continue"}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
function SettingsModal({
  progress,
  setProgress,
  onClose,
}: {
  progress: Progress;
  setProgress: React.Dispatch<React.SetStateAction<Progress>>;
  onClose: () => void;
}) {
  const [name, setName] = useState(progress.name);
  const [goal, setGoal] = useState(progress.goal);
  const [sound, setSound] = useState(progress.sound);
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Make Yalla yours" onClose={onClose}>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          setProgress((p) => ({ ...p, name: name.trim(), goal, sound }));
          onClose();
        }}
      >
        <label>
          Your first name
          <input
            value={name}
            maxLength={30}
            placeholder="What should Zaytoun call you?"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Your daily goal
          <select
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          >
            <option value={10}>A little practice · 10 XP</option>
            <option value={30}>One little lesson · 30 XP</option>
            <option value={60}>Feeling inspired · 60 XP</option>
          </select>
        </label>
        <label className="toggle-label">
          <span>
            Pronunciation audio
            <small>Uses your device’s Arabic voice, when available.</small>
          </span>
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => setSound(e.target.checked)}
          />
        </label>
        <button className="primary" type="submit">
          Save changes
          <Check size={17} />
        </button>
        <div className="reset-area">
          {confirm ? (
            <>
              <p>
                Reset all XP, completed lessons, saved phrases, and
                achievements? This can’t be undone.
              </p>
              <div>
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    setProgress({ ...emptyProgress });
                    onClose();
                  }}
                >
                  Yes, reset my progress
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              className="text-button"
              type="button"
              onClick={() => setConfirm(true)}
            >
              <RotateCcw size={15} /> Reset progress
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
