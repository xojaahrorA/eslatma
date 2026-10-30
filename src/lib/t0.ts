import type { Lang, ParsedInput, Priority, Task } from "./types";
import { addDays, isoLocal, startOfDay } from "./utils-app";

// ─── T0 qoidalar dvigateli (PRD 5.2 daraja T0) ──────────────────────────────
// AI'siz, deterministik: sana, vaqt, ustuvorlik, teg, takror — qoidalar orqali.
// Har til uchun lug'atlar. Hisob-kitob KODDA bajariladi, modelda emas (PRD 5.4).

interface WeekdayMap {
  names: string[];
  aliases?: string[][];
}

const WEEKDAYS: Record<Lang, WeekdayMap> = {
  uz: {
    names: ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"],
    aliases: [
      ["yak", "yakshanba"],
      ["dush", "dushanba"],
      ["sesh", "seshanba"],
      ["chor", "chorshanba"],
      ["pay", "payshanba"],
      ["juma", "jum"],
      ["shan", "shanba"],
    ],
  },
  ru: {
    names: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
    aliases: [
      ["вс", "воскр"],
      ["пн", "понед"],
      ["вт", "вторн"],
      ["ср", "сред"],
      ["чт", "четв"],
      ["пт", "пятниц", "пят"],
      ["сб", "суббот", "суб"],
    ],
  },
  en: {
    names: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    aliases: [["sun"], ["mon"], ["tue", "tues"], ["wed"], ["thu", "thur", "thurs"], ["fri"], ["sat"]],
  },
};

const TODAY_WORDS = ["bugun", "today", "сегодня"];
const TOMORROW_WORDS = ["ertaga", "tomorrow", "завтра"];

const PRIORITY_WORDS: { words: string[]; level: Priority }[] = [
  { words: ["zudokli", "zudlik", "urgent", "срочно", "критично"], level: "critical" },
  { words: ["yuqori", "baland", "high", "важно", "высокий"], level: "high" },
  { words: ["orta", "o'rta", "medium", "средний"], level: "medium" },
  { words: ["past", "low", "низкий"], level: "low" },
];

const REPEAT_WORDS: { words: string[]; rule: Task["repeat"] }[] = [
  { words: ["har kuni", "everyday", "every day", "каждый день", "ежедневно"], rule: "daily" },
  { words: ["har kunda", "каждые 3 дня", "every 3 days", "har 3 kunda"], rule: "every3d" },
  { words: ["har hafta", "weekly", "каждую неделю"], rule: "weekly" },
  { words: ["ish kunlari", "weekdays", "рабочие дни"], rule: "weekdays" },
];

const norm = (s: string) => s.toLowerCase().replace(/[’ʻ`]/g, "'").trim();

function nextWeekdayDate(target: number): Date {
  const base = startOfDay(new Date());
  let diff = (target - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7; // "keyingi shanba" — kelgusi shanba
  return addDays(base, diff);
}

/** "9 da", "9:30", "9.30", "soat 9", "в 9", "at 9:30" → { h, m } */
function parseTimeToken(token: string): { h: number; m: number } | null {
  const t = token.replace(/[)(",.!?]/g, "");
  let m = t.match(/^(\d{1,2})[:.](\d{2})$/);
  if (m) {
    const h = Number(m[1]), mi = Number(m[2]);
    if (h >= 0 && h < 24 && mi < 60) return { h, m: mi };
  }
  m = t.match(/^(\d{1,2})(?:da|ч|:?00h?)$/i);
  if (m) {
    const h = Number(m[1]);
    if (h >= 0 && h < 24) return { h, m: 0 };
  }
  return null;
}

/** "1 soat", "30 daqiqa", "90 min", "2h", "1ч" → daqiqalar */
function parseDurationToken(tokens: string[], i: number): { min: number; consumed: number } | null {
  const t = tokens[i];
  const num = t.match(/^(\d+)(?:h|soat|ч|hour)?$/i);
  const next = tokens[i + 1] ? norm(tokens[i + 1]) : "";
  if (num) {
    const n = Number(num[1]);
    if (/^(h|soat|ч|hour)/i.test(num[2] || "") || /^(soat|час|h\b|hour)/.test(next)) return { min: n * 60, consumed: next && /^(soat|час|h\b|hour)/.test(next) ? 2 : 1 };
    if (/^(daqiqa|min|мин|м|minutes?)/.test(next)) return { min: n, consumed: 2 };
    if (/^\d+$/.test(t) && n > 5 && n <= 240 && /^(daq|min|мин)/.test(next)) return { min: n, consumed: 2 };
  }
  const frac = t.match(/^(\d+)(?:daq|min|мин)$/i);
  if (frac) return { min: Number(frac[1]), consumed: 1 };
  const hrSuf = t.match(/^(\d+)(?:h|soat|час)$/i);
  if (hrSuf) return { min: Number(hrSuf[1]) * 60, consumed: 1 };
  return null;
}

/**
 * Tezkor kiritishni tahlil qiladi.
 * Misol: "ertaga 9 da imtihon tayyorgarlik !yuqori #o'qish"
 */
export function parseQuickInput(input: string, lang: Lang): ParsedInput {
  let dayIsExplicit = false;
  const raw = input.trim();
  const tokens = raw.split(/\s+/).filter(Boolean);
  const matched: ParsedInput["matched"] = [];
  const tags: string[] = [];
  const skipped = new Set<number>();
  let dueAt: string | undefined;
  let hasTime = false;
  let priority: Priority | undefined;
  let repeat: Task["repeat"] | undefined;
  let estimateMin: number | undefined;
  let dayTarget: Date | null = null;

  const lowerTokens = tokens.map(norm);

  // 1) takror qoidalari (ko'p so'zli — avval tekshiramiz)
  for (let i = 0; i < tokens.length; i++) {
    if (skipped.has(i)) continue;
    for (const r of REPEAT_WORDS) {
      for (const w of r.words) {
        const joined = lowerTokens.slice(i, i + w.split(" ").length).join(" ");
        if (joined === w) {
          repeat = r.rule;
          matched.push({ type: "repeat", label: w });
          for (let k = i; k < i + w.split(" ").length; k++) skipped.add(k);
          break;
        }
      }
      if (repeat) break;
    }
  }

  // 2) so'z-so'z tahlil
  for (let i = 0; i < tokens.length; i++) {
    if (skipped.has(i)) continue;
    const tok = lowerTokens[i];
    const orig = tokens[i];

    // #teg va @teg
    if (orig.startsWith("#") && orig.length > 1) {
      tags.push(orig.slice(1));
      matched.push({ type: "tag", label: orig });
      skipped.add(i);
      continue;
    }

    // !ustuvorlik
    if (orig.startsWith("!")) {
      const w = tok.slice(1);
      let found = false;
      if (/^[1-4]$/.test(w)) {
        priority = (["critical", "high", "medium", "low"] as Priority[])[Number(w) - 1];
        found = true;
      } else {
        for (const p of PRIORITY_WORDS) {
          if (p.words.includes(w)) { priority = p.level; found = true; break; }
        }
      }
      if (found) {
        matched.push({ type: "priority", label: orig });
        skipped.add(i);
        continue;
      }
    }

    // davomiylik — vaqt tekshiruvidan OLDIN ("1 soat" = 60 daqiqa, 01:00 emas)
    const dur = parseDurationToken(tokens, i);
    if (dur && !estimateMin) {
      estimateMin = dur.min;
      for (let k = i; k < i + dur.consumed; k++) skipped.add(k);
      matched.push({ type: "estimate", label: `${dur.min}m` });
      i += dur.consumed - 1;
      continue;
    }

    // vaqt: "9:30", "9da"
    const time = parseTimeToken(tok.replace(/\u00a0/g, " "));
    if (time) {
      dayTarget = dayTarget ?? startOfDay(new Date());
      const d = new Date(dayTarget);
      d.setHours(time.h, time.m, 0, 0);
      if (d.getTime() < Date.now() && !dayIsExplicit) {
        d.setDate(d.getDate() + 1); // o'tib ketgan vaqt → ertaga
      }
      dueAt = isoLocal(d);
      hasTime = true;
      matched.push({ type: "time", label: `${String(time.h).padStart(2, "0")}:${String(time.m).padStart(2, "0")}` });
      skipped.add(i);
      continue;
    }
    // "9 da" / "в 9" / "at 9" — ikki tokenda; "soat 9" (aylantirilgan) ham
    const nxt = norm(tokens[i + 1] || "");
    if (/^\d{1,2}$/.test(tok) && /^(da|да|:00|at)$/i.test(nxt)) {
      const h = Number(tok);
      if (h >= 0 && h < 24) {
        dayTarget = dayTarget ?? startOfDay(new Date());
        const d = new Date(dayTarget);
        d.setHours(h, 0, 0, 0);
        if (d.getTime() < Date.now() && !dayIsExplicit) d.setDate(d.getDate() + 1);
        dueAt = isoLocal(d);
        hasTime = true;
        matched.push({ type: "time", label: `${String(h).padStart(2, "0")}:00` });
        skipped.add(i);
        skipped.add(i + 1);
        continue;
      }
    }
    if (/^(soat|час)$/.test(tok) && /^\d{1,2}$/.test(nxt)) {
      const h = Number(nxt);
      if (h >= 0 && h < 24) {
        dayTarget = dayTarget ?? startOfDay(new Date());
        const d = new Date(dayTarget);
        d.setHours(h, 0, 0, 0);
        if (d.getTime() < Date.now() && !dayIsExplicit) d.setDate(d.getDate() + 1);
        dueAt = isoLocal(d);
        hasTime = true;
        matched.push({ type: "time", label: `${String(h).padStart(2, "0")}:00` });
        skipped.add(i);
        skipped.add(i + 1);
        continue;
      }
    }

    // sanalar
    if (TODAY_WORDS.includes(tok)) {
      dayTarget = startOfDay(new Date());
      dueAt = isoLocal(dayTarget);
      matched.push({ type: "date", label: orig });
      skipped.add(i);
      dayIsExplicit = true;
      continue;
    }
    if (TOMORROW_WORDS.includes(tok)) {
      dayTarget = addDays(startOfDay(new Date()), 1);
      dueAt = isoLocal(dayTarget);
      matched.push({ type: "date", label: orig });
      skipped.add(i);
      dayIsExplicit = true;
      continue;
    }
    // hafta kuni
    const wd = WEEKDAYS[lang];
    let dayIdx = wd.names.findIndex((n) => tok.startsWith(n.slice(0, Math.max(3, n.length - 2))));
    if (dayIdx === -1 && wd.aliases) {
      dayIdx = wd.aliases.findIndex((al) => al.some((a) => tok.startsWith(a)));
    }
    if (dayIdx !== -1) {
      const d = nextWeekdayDate(dayIdx);
      dayTarget = d;
      dueAt = isoLocal(d);
      matched.push({ type: "date", label: orig });
      skipped.add(i);
      dayIsExplicit = true;
      continue;
    }
  }

  const title = tokens.filter((_, i) => !skipped.has(i)).join(" ").trim();

  return {
    title: title || raw,
    dueAt,
    hasTime,
    priority,
    tags,
    repeat,
    estimateMin,
    matched,
  };
}

/** parsedInput → Task yaratish uchun qisman obyekt */
export function parsedToTaskDraft(p: ParsedInput, lang: Lang) {
  return {
    title: p.title,
    dueAt: p.dueAt,
    hasTime: p.hasTime,
    priority: p.priority ?? ("medium" as Priority),
    tags: p.tags,
    repeat: p.repeat ?? ("none" as Task["repeat"]),
    estimateMin: p.estimateMin,
    source: "t0" as const,
  };
}

/**
 * T0 taklifi — AI o'rniga deterministik "dasturchi" (fallback rejimi)
 */
export function t0ProposalFromCommand(
  command: string,
  lang: Lang,
  ctx: { openTasks: { id: string; title: string; dueAt?: string }[] }
) {
  const p = parseQuickInput(command, lang);
  const actions: {
    action: string;
    params: Record<string, unknown>;
    reason: string;
    confidence: number;
  }[] = [];

  const hasCreateIntent = p.title.length > 1;

  if (hasCreateIntent) {
    actions.push({
      action: "task.create",
      params: {
        title: p.title,
        ...(p.dueAt ? { due_at: p.dueAt } : {}),
        priority: p.priority ?? "medium",
        tags: p.tags,
        ...(p.estimateMin ? { estimate_min: p.estimateMin } : {}),
      },
      reason: "T0: buyruqda yangi vazifa aniqlandi (vaqt, ustuvorlik va teglar qoidalar dvigateli tomonidan ajratildi)",
      confidence: p.dueAt ? 0.9 : 0.72,
    });
  }

  // "hisobot" so'rovi → summary
  if (/(hisobot|report|отчет|отчёт|qisqacha|кратко|summary)/i.test(command)) {
    actions.push({
      action: "summary.create",
      params: { scope: "today" },
      reason: "T0: buyruqda hisobot so'rovi kaliti topildi",
      confidence: 0.85,
    });
  }

  return {
    proposal_id: "",
    summary:
      actions.length > 0
        ? `T0 dvigateli ${actions.length} amal taklif qildi`
        : "T0 dvigateli aniq amal topolmadi",
    actions,
    conflicts: [],
    model: { provider: "t0-rules-engine", class: "Lite" },
    data_used: ["command:text"],
    requires_approval: true,
  };
}
