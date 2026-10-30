import type { Lang, Priority, TaskStatus } from "./types";

// ─── ID: UUIDv7 — qurilmada oflayn yaratiladi (PRD 10-bo'lim) ────────────────
export function uuidv7(): string {
  const ts = Date.now();
  const hexTs = ts.toString(16).padStart(12, "0");
  const bytes = new Uint8Array(9);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 9; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const r = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hexTs.slice(0, 8)}-${hexTs.slice(8, 12)}-7${r.slice(0, 3)}-8${r.slice(3, 6)}-${r.slice(6, 18)}`;
}

// ─── Xesh zanjiri (audit jurnali uchun FNV-1a) ───────────────────────────────
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function chainHash(prev: string, payload: string): string {
  return fnv1a(prev + "|" + payload);
}

// ─── Sana/vaqt yordamchilari (mahalliy vaqt) ─────────────────────────────────

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** yyyy-MM-dd (mahalliy) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** yyyy-MM-dd'T'HH:mm (mahalliy, floating) */
export function isoLocal(d: Date): string {
  return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function parseLocal(iso?: string): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + "T09:00");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Haftaning boshi — dushanba (PRD: sozlanadigan, odatiy dushanba) */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = dushanba
  x.setDate(x.getDate() - day);
  return x;
}

const intlLocale: Record<Lang, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};

// ─── Maxsus sana lug'atlari (uz ICU ba'zi muhitlarda cheklangan) ────────────
const MONTHS: Record<Lang, string[]> = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MONTHS_SHORT: Record<Lang, string[]> = {
  uz: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
  ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const WD_LONG: Record<Lang, string[]> = {
  uz: ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"],
  ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const WD_NARROW: Record<Lang, string[]> = {
  uz: ["Y", "D", "S", "Ch", "P", "J", "Sh"],
  ru: ["В", "П", "В", "С", "Ч", "П", "С"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};

export function fmtTime(iso: string | undefined, lang: Lang): string {
  const d = parseLocal(iso);
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDay(d: Date, lang: Lang): string {
  return fmtShortDate(d, lang);
}

export function fmtLongDate(d: Date, lang: Lang): string {
  if (lang === "ru") return `${d.getDate()} ${MONTHS.ru[d.getMonth()]}, ${WD_LONG.ru[d.getDay()].toLowerCase()}`;
  if (lang === "en") return `${WD_LONG.en[d.getDay()]}, ${MONTHS.en[d.getMonth()]} ${d.getDate()}`;
  return `${d.getDate()}-${MONTHS.uz[d.getMonth()]}, ${WD_LONG.uz[d.getDay()]}`;
}

export function fmtShortDate(d: Date, lang: Lang): string {
  if (lang === "ru") return `${d.getDate()} ${MONTHS_SHORT.ru[d.getMonth()]}`;
  if (lang === "en") return `${MONTHS_SHORT.en[d.getMonth()]} ${d.getDate()}`;
  return `${d.getDate()}-${MONTHS_SHORT.uz[d.getMonth()]}`;
}

export function monthName(m: number, lang: Lang): string {
  return MONTHS[lang][m];
}

export function monthShort(m: number, lang: Lang): string {
  return MONTHS_SHORT[lang][m];
}

export function fmtWeekday(d: Date, lang: Lang, narrow = false): string {
  if (narrow) return WD_NARROW[lang][d.getDay()];
  return WD_LONG[lang][d.getDay()].slice(0, lang === "en" ? 3 : 3).replace(/^./, (c) => c.toUpperCase());
}

export function weekdayNarrow(d: Date, lang: Lang): string {
  return WD_NARROW[lang][d.getDay()];
}

export function fmtMinutes(min: number, t: (k: string) => string): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0 && m > 0) return t("time.hm").replace("{h}", String(h)).replace("{m}", String(m));
  if (h > 0) return t("time.h").replace("{h}", String(h));
  return t("time.m").replace("{m}", String(m));
}

export function relDay(d: Date, t: (k: string) => string, lang: Lang = "uz"): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  if (diff === 0) return t("day.today");
  if (diff === 1) return t("day.tomorrow");
  if (diff === -1) return t("day.yesterday");
  return fmtShortDate(d, lang);
}

// ─── Ranglar: ustuvorlik va statuslar ────────────────────────────────────────

export const PRIORITY_STYLE: Record<
  Priority,
  { spine: string; chip: string; dot: string; labelKey: string }
> = {
  critical: {
    spine: "bg-rose-500",
    chip: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25",
    dot: "bg-rose-500",
    labelKey: "priority.critical",
  },
  high: {
    spine: "bg-orange-500",
    chip: "bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/25",
    dot: "bg-orange-500",
    labelKey: "priority.high",
  },
  medium: {
    spine: "bg-amber-400",
    chip: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/25",
    dot: "bg-amber-400",
    labelKey: "priority.medium",
  },
  low: {
    spine: "bg-zinc-400",
    chip: "bg-zinc-400/12 text-zinc-600 dark:text-zinc-400 border-zinc-400/25",
    dot: "bg-zinc-400",
    labelKey: "priority.low",
  },
};

export const HABIT_COLORS: Record<
  string,
  { bg: string; text: string; ring: string; soft: string }
> = {
  orange: { bg: "bg-orange-500", text: "text-orange-500", ring: "stroke-orange-500", soft: "bg-orange-500/10" },
  violet: { bg: "bg-violet-500", text: "text-violet-500", ring: "stroke-violet-500", soft: "bg-violet-500/10" },
  teal: { bg: "bg-teal-500", text: "text-teal-500", ring: "stroke-teal-500", soft: "bg-teal-500/10" },
  rose: { bg: "bg-rose-500", text: "text-rose-500", ring: "stroke-rose-500", soft: "bg-rose-500/10" },
  lime: { bg: "bg-lime-500", text: "text-lime-600 dark:text-lime-400", ring: "stroke-lime-500", soft: "bg-lime-500/10" },
};

export const STATUS_STYLE: Record<TaskStatus, { chip: string }> = {
  todo: { chip: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
  in_progress: { chip: "bg-violet-500/12 text-violet-600 dark:text-violet-300" },
  done: { chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  deferred: { chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  cancelled: { chip: "bg-zinc-400/10 text-zinc-500" },
  missed: { chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

export const CATEGORY_ICON: Record<string, string> = {
  food: "🍜",
  transport: "🚌",
  home: "🏠",
  health: "💊",
  fun: "🎬",
  other: "📦",
};

/** Xavf darajasi (PRD 6.3): amal turi bo'yicha */
export function riskLevelOf(action: string, count = 1): "R1" | "R2" | "R3" | "R4" {
  if (action === "summary.create" || action === "plan.propose") return "R1";
  if (count > 5) return "R3";
  return "R2";
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function timeToMin(isoTime: string): number {
  const [h, m] = isoTime.split(":").map(Number);
  return h * 60 + (m || 0);
}
