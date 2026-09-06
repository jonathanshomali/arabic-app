import { phraseTips } from "./phraseTips";
import { moreLessons } from "./moreLessons";
export type Phrase = {
  ar: string;
  latin: string;
  en: string;
  note?: string;
  tip?: string;
};
export type Lesson = {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  phrases: Phrase[];
  tip: string;
};
const starterLessons: Lesson[] = [
  {
    id: 0,
    title: "First words",
    subtitle: "A little hello goes a long way",
    icon: "hand",
    tip: "Marhaba works any time of day. A friendly reply is “ahleen!” — a warm hello right back.",
    phrases: [
      { ar: "مرحبا", latin: "marhaba", en: "Hello" },
      { ar: "أهلين", latin: "ahleen", en: "Hi there" },
      { ar: "شكراً", latin: "shukran", en: "Thank you" },
      {
        ar: "يلا",
        latin: "yalla",
        en: "Let’s go",
        note: "Also used as “come on,” depending on the situation.",
      },
      { ar: "مع السلامة", latin: "ma‘ is-salaameh", en: "Goodbye" },
    ],
  },
  {
    id: 1,
    title: "How are you?",
    subtitle: "Turn a hello into a conversation",
    icon: "chat",
    tip: "Talking to a man? Say “keefak.” Talking to a woman? Say “keefik.” Small changes make your Arabic feel more personal.",
    phrases: [
      {
        ar: "كيفك؟",
        latin: "keefak? / keefik?",
        en: "How are you?",
        note: "Keefak to a man; keefik to a woman.",
      },
      {
        ar: "منيح",
        latin: "mneeh",
        en: "Good",
        note: "A man says mneeh; a woman says mneeha (منيحة).",
      },
      { ar: "الحمد لله", latin: "il-hamdillah", en: "Thank God" },
      {
        ar: "وإنت؟",
        latin: "w inta? / w inti?",
        en: "And you?",
        note: "Inta to a man; inti to a woman.",
      },
      { ar: "تمام", latin: "tamaam", en: "All good" },
    ],
  },
  {
    id: 2,
    title: "Nice to meet you",
    subtitle: "Names, introductions & new friends",
    icon: "smile",
    tip: "You’ll hear “shu” everywhere in Palestinian Arabic. It means “what” — as in “shu ismak?” (what’s your name?).",
    phrases: [
      {
        ar: "شو اسمك؟",
        latin: "shu ismak? / shu ismik?",
        en: "What’s your name?",
        note: "Ismak to a man; ismik to a woman.",
      },
      { ar: "اسمي", latin: "ismi", en: "My name is" },
      {
        ar: "أنا من فلسطين",
        latin: "ana min falasteen",
        en: "I’m from Palestine",
      },
      { ar: "أهلاً وسهلاً", latin: "ahlan w sahlan", en: "Welcome" },
      { ar: "تشرفنا", latin: "tsharrafna", en: "Nice to meet you" },
    ],
  },
  {
    id: 3,
    title: "The little essentials",
    subtitle: "A few words for every day",
    icon: "spark",
    tip: "“Biddi” means “I want.” Combine it with something you know: “biddi mayy” means “I want water.”",
    phrases: [
      { ar: "آه", latin: "aah", en: "Yes" },
      { ar: "لا", latin: "laa", en: "No" },
      {
        ar: "لو سمحت",
        latin: "law samaht / law samahti",
        en: "Please / excuse me",
        note: "Samaht to a man; samahti to a woman.",
      },
      { ar: "بدي", latin: "biddi", en: "I want" },
      { ar: "ما بعرف", latin: "ma ba‘raf", en: "I don’t know" },
    ],
  },
  {
    id: 4,
    title: "At the café",
    subtitle: "Your first order, in Arabic",
    icon: "coffee",
    tip: "“Ahweh” is a common urban pronunciation of coffee. Palestinian pronunciation varies by town, village, and community.",
    phrases: [
      { ar: "قهوة", latin: "ahweh", en: "Coffee" },
      { ar: "شاي", latin: "shaay", en: "Tea" },
      { ar: "مي", latin: "mayy", en: "Water" },
      { ar: "بدون سكر", latin: "bidoon sukkar", en: "Without sugar" },
      {
        ar: "الحساب لو سمحت",
        latin: "il-hsaab law samaht",
        en: "The bill, please",
      },
    ],
  },
  {
    id: 5,
    title: "A taste of Palestine",
    subtitle: "Good food, better conversation",
    icon: "food",
    tip: "“Sahtein” literally means “two healths.” You can say it to someone enjoying a meal — a little wish for their well-being.",
    phrases: [
      { ar: "خبز", latin: "khubiz", en: "Bread" },
      { ar: "زيت زيتون", latin: "zeit zaytoon", en: "Olive oil" },
      { ar: "زعتر", latin: "za‘tar", en: "Za’atar" },
      {
        ar: "زاكي",
        latin: "zaaki",
        en: "Delicious",
        note: "Use zaakyeh (زاكية) with feminine nouns.",
      },
      { ar: "صحتين", latin: "sahtein", en: "Enjoy your meal" },
    ],
  },
  {
    id: 6,
    title: "Around the neighborhood",
    subtitle: "Find your way & feel at home",
    icon: "map",
    tip: "“Wein” is your go-to word for “where.” Add the place you’re looking for, and you’re ready to ask for directions.",
    phrases: [
      { ar: "وين؟", latin: "wein?", en: "Where?" },
      { ar: "هون", latin: "hoon", en: "Here" },
      { ar: "هناك", latin: "hunaak", en: "There" },
      { ar: "يمين", latin: "yameen", en: "Right" },
      { ar: "شمال", latin: "shmaal", en: "Left" },
    ],
  },
  {
    id: 7,
    title: "Make it a conversation",
    subtitle: "Bring your new words together",
    icon: "heart",
    tip: "You don’t need perfect Arabic to connect. A few words, a little curiosity, and a smile are a lovely start.",
    phrases: [
      { ar: "بدي قهوة", latin: "biddi ahweh", en: "I want a coffee" },
      {
        ar: "وين القهوة؟",
        latin: "wein il-ahweh?",
        en: "Where is the coffee?",
      },
      {
        ar: "شو بدك؟",
        latin: "shu biddak? / shu biddik?",
        en: "What do you want?",
        note: "Biddak to a man; biddik to a woman.",
      },
      { ar: "يلا نروح", latin: "yalla nrooh", en: "Let’s leave" },
      {
        ar: "بشوفك بكرا",
        latin: "bshoofak bukra / bshoofik bukra",
        en: "See you tomorrow",
        note: "Bshoofak to a man; bshoofik to a woman.",
      },
    ],
  },
];
export const lessons: Lesson[] = [
  ...starterLessons.map((l) => ({
    ...l,
    phrases: l.phrases.map((p) => ({ ...p, tip: phraseTips[p.ar] })),
  })),
  ...moreLessons,
];
export const allPhrases = lessons.flatMap((l) =>
  l.phrases.map((p) => ({ ...p, lesson: l.title, lessonId: l.id })),
);
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export type Progress = {
  completed: number[];
  xp: number;
  activity: Record<string, number>;
  goal: number;
  name: string;
  sound: boolean;
  saved: string[];
  practices: number;
};
export const emptyProgress: Progress = {
  completed: [],
  xp: 0,
  activity: {},
  goal: 30,
  name: "",
  sound: true,
  saved: [],
  practices: 0,
};
export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem("yalla-progress") || "null");
    if (!p || !Array.isArray(p.completed) || typeof p.xp !== "number")
      return emptyProgress;
    return { ...emptyProgress, ...p };
  } catch {
    return emptyProgress;
  }
}
export function getStreak(activity: Record<string, number>) {
  const d = new Date();
  let n = 0;
  if (!activity[localDate(d)]) d.setDate(d.getDate() - 1);
  while (activity[localDate(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
