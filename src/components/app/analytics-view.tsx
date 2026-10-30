"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, SectionHead, Chip, Segmented, EmptyState } from "./kit";
import {
  addDays,
  clamp,
  dateKey,
  fmtMinutes,
  fmtShortDate,
  fmtWeekday,
  HABIT_COLORS,
  monthName,
  monthShort,
  startOfDay,
  startOfWeek,
  weekdayNarrow,
  CATEGORY_ICON,
} from "@/lib/utils-app";
import type { Lang } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BarChart3,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lightbulb,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";

// ─── Analitika — hayotingiz raqamlarda (Hafta / Oy / Yil) ───────────────────
// Har bir bo'lim o'z dizayniga ega: data-viz estetikasi, to'q stakan kartalar,
// gradient Life Score va "Wrapped" uslubidagi yillik xotira kartasi.

type Mode = "week" | "month" | "year";

interface Bucket {
  key: string;
  label: string;
  done: number;
  missed: number;
  focus: number;
  spent: number;
  habits: number;
}

interface HabitAdh {
  id: string;
  emoji: string;
  title: string;
  color: string;
  pct: number;
  streak: number;
}

interface PeriodData {
  start: Date;
  end: Date;
  days: number;
  label: string;
  buckets: Bucket[];
  done: number;
  missed: number;
  focusMin: number;
  spent: number;
  habitActual: number;
  habitExpected: number;
  notesCreated: number;
  byCat: Record<string, number>;
  habits: HabitAdh[];
  completion: number; // 0..1
  activeDays: number;
}

// ─── Yordamchilar ────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

const CAT_COLOR: Record<string, string> = {
  food: "bg-orange-500",
  transport: "bg-teal-500",
  home: "bg-violet-500",
  health: "bg-rose-500",
  fun: "bg-amber-500",
  other: "bg-zinc-400",
};

function periodRange(mode: Mode, offset: number): { start: Date; end: Date } {
  const now = startOfDay(new Date());
  if (mode === "week") {
    const ref = addDays(startOfWeek(now), offset * 7);
    return { start: ref, end: addDays(ref, 6) };
  }
  if (mode === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start, end };
  }
  const y = now.getFullYear() + offset;
  return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
}

function periodLabel(mode: Mode, offset: number, lang: Lang): string {
  const { start, end } = periodRange(mode, offset);
  if (mode === "week") return `${fmtShortDate(start, lang)} – ${fmtShortDate(end, lang)}`;
  if (mode === "month") return `${monthName(start.getMonth(), lang)} ${start.getFullYear()}`;
  return String(start.getFullYear());
}

// ─── Hisoblash: davr bo'yicha barcha ko'rsatkichlar ─────────────────────────

function computePeriod(
  mode: Mode,
  offset: number,
  lang: Lang,
  data: {
    tasks: ReturnType<typeof useStore.getState>["tasks"];
    habits: ReturnType<typeof useStore.getState>["habits"];
    habitLogs: ReturnType<typeof useStore.getState>["habitLogs"];
    timeEntries: ReturnType<typeof useStore.getState>["timeEntries"];
    expenses: ReturnType<typeof useStore.getState>["expenses"];
    notes: ReturnType<typeof useStore.getState>["notes"];
  }
): PeriodData {
  const { tasks, habits, habitLogs, timeEntries, expenses, notes } = data;
  const { start, end } = periodRange(mode, offset);
  const ks = dateKey(start);
  const ke = dateKey(end);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  // Novdalar
  const buckets: Bucket[] = [];
  const idxOf = new Map<string, number>();
  if (mode === "year") {
    for (let m = 0; m < 12; m++) {
      idxOf.set(`${start.getFullYear()}-${String(m + 1).padStart(2, "0")}`, m);
      buckets.push({ key: `${m}`, label: monthShort(m, lang), done: 0, missed: 0, focus: 0, spent: 0, habits: 0 });
    }
  } else {
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const k = dateKey(d);
      idxOf.set(k, buckets.length);
      buckets.push({
        key: k,
        label: mode === "week" ? weekdayNarrow(d, lang) : String(d.getDate()),
        done: 0,
        missed: 0,
        focus: 0,
        spent: 0,
        habits: 0,
      });
    }
  }
  const sl = mode === "year" ? 7 : 10;

  for (const t of tasks) {
    if (t.status === "done" && t.completedAt) {
      const i = idxOf.get(t.completedAt.slice(0, sl));
      if (i !== undefined) buckets[i].done++;
    } else if (t.status === "missed" && t.dueAt) {
      const i = idxOf.get(t.dueAt.slice(0, sl));
      if (i !== undefined) buckets[i].missed++;
    }
  }
  for (const e of timeEntries) {
    if (e.mode !== "focus") continue;
    const i = idxOf.get(e.start.slice(0, sl));
    if (i !== undefined) {
      buckets[i].focus += Math.max(0, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000);
    }
  }
  for (const x of expenses) {
    const i = idxOf.get(x.date.slice(0, sl));
    if (i !== undefined) buckets[i].spent += x.amount;
  }
  for (const l of habitLogs) {
    const i = idxOf.get(l.date.slice(0, sl));
    if (i !== undefined && l.value > 0) buckets[i].habits += l.value;
  }

  const done = buckets.reduce((a, b) => a + b.done, 0);
  const missed = buckets.reduce((a, b) => a + b.missed, 0);
  const focusMin = buckets.reduce((a, b) => a + b.focus, 0);
  const spent = buckets.reduce((a, b) => a + b.spent, 0);
  const habitActual = buckets.reduce((a, b) => a + b.habits, 0);

  const byCat: Record<string, number> = {};
  for (const x of expenses) {
    if (x.date >= ks && x.date <= ke) byCat[x.category] = (byCat[x.category] ?? 0) + x.amount;
  }
  const notesCreated = notes.filter((n) => n.createdAt.slice(0, 10) >= ks && n.createdAt.slice(0, 10) <= ke).length;

  // Odatlar barqarorligi + ketma-ketlik
  const habitAdh: HabitAdh[] = habits
    .filter((h) => !h.archived)
    .map((h) => {
      const logs = habitLogs.filter((l) => l.habitId === h.id && l.date >= ks && l.date <= ke);
      const actual = logs.reduce((a, l) => a + l.value, 0);
      const expected = (h.perWeek / 7) * days;
      let streak = 0;
      let run = 0;
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const k = dateKey(d);
        const v = logs.find((l) => l.date === k)?.value ?? 0;
        if (v > 0) {
          run++;
          streak = Math.max(streak, run);
        } else run = 0;
      }
      return {
        id: h.id,
        emoji: h.emoji,
        title: h.title,
        color: h.color,
        pct: expected > 0 ? clamp(actual / expected, 0, 1) : 0,
        streak,
      };
    });

  const habitExpected = habits.filter((h) => !h.archived).reduce((a, h) => a + (h.perWeek / 7) * days, 0);

  // Faol kunlar: yil rejimida kunlarni to'g'ridan-to'g'ri sanaymiz
  let activeDays: number;
  if (mode === "year") {
    const doneMap = new Map<string, number>();
    const habMap = new Map<string, number>();
    for (const tk of tasks) {
      if (tk.status === "done" && tk.completedAt) {
        const k = tk.completedAt.slice(0, 10);
        if (k >= ks && k <= ke) doneMap.set(k, (doneMap.get(k) ?? 0) + 1);
      }
    }
    for (const l of habitLogs) {
      if (l.value > 0 && l.date >= ks && l.date <= ke) habMap.set(l.date, 1);
    }
    activeDays = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const k = dateKey(d);
      if ((doneMap.get(k) ?? 0) > 0 || habMap.has(k)) activeDays++;
    }
  } else {
    activeDays = buckets.filter((b) => b.done > 0 || b.habits > 0 || b.focus > 0).length;
  }

  return {
    start,
    end,
    days,
    label: periodLabel(mode, offset, lang),
    buckets,
    done,
    missed,
    focusMin,
    spent,
    habitActual,
    habitExpected,
    notesCreated,
    byCat,
    habits: habitAdh,
    completion: done + missed > 0 ? done / (done + missed) : 0,
    activeDays,
  };
}

// ─── Life Score: 0..100 kompozit ─────────────────────────────────────────────

function lifeScore(p: PeriodData, budget: number): number {
  const parts: { w: number; v: number | null }[] = [
    { w: 0.4, v: p.done + p.missed > 0 ? p.completion : null },
    { w: 0.3, v: p.habitExpected > 0 ? clamp(p.habitActual / p.habitExpected, 0, 1) : null },
    { w: 0.2, v: p.focusMin > 0 ? clamp(p.focusMin / (p.days * 30), 0, 1) : 0 },
    {
      w: 0.1,
      v: p.spent > 0 && budget > 0 ? clamp(1 - Math.max(0, p.spent - budget * (p.days / 30)) / (budget * (p.days / 30)), 0, 1) : null,
    },
  ];
  const live = parts.filter((x) => x.v !== null);
  if (live.length === 0) return 0;
  const wSum = live.reduce((a, x) => a + x.w, 0);
  return Math.round((live.reduce((a, x) => a + (x.v as number) * x.w, 0) / wSum) * 100);
}

// ─── Vizual bloklar ──────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size = 116;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#scoreGrad)"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamp(score / 100, 0, 1)) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-3xl font-bold tabular-nums leading-none"
        >
          {score}
        </motion.span>
      </div>
    </div>
  );
}

function StackBars({
  buckets,
  labels,
  selected,
  onSelect,
}: {
  buckets: Bucket[];
  labels: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const maxV = Math.max(2, ...buckets.map((b) => b.done + b.missed));
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {buckets.map((b, i) => {
        const total = b.done + b.missed;
        const hPct = total > 0 ? Math.max(8, (total / maxV) * 95) : 3;
        const donePart = total > 0 ? (b.done / total) * 100 : 0;
        const isSel = selected === i;
        return (
          <button
            key={b.key}
            onClick={() => onSelect(isSel ? -1 : i)}
            aria-label={`${labels[i] || b.label}: ${b.done}`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex min-h-0 w-full flex-1 items-end justify-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${hPct}%` }}
                transition={{ delay: i * 0.02, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "flex w-full max-w-[24px] flex-col justify-end overflow-hidden rounded-md",
                  isSel && "ring-2 ring-violet-500/60"
                )}
              >
                {b.missed > 0 && <div className="w-full bg-rose-500/75" style={{ height: `${100 - donePart}%` }} />}
                {b.done > 0 && (
                  <div
                    className={cn("w-full bg-emerald-500 group-hover:bg-emerald-400", b.missed > 0 ? "" : "rounded-md")}
                    style={{ height: `${donePart}%` }}
                  />
                )}
                {total === 0 && <div className="h-full w-full rounded-md bg-muted-foreground/15" />}
              </motion.div>
            </div>
            <span
              className={cn(
                "h-[11px] text-[9px] leading-none",
                isSel ? "font-bold text-violet-500" : "text-muted-foreground/60"
              )}
            >
              {labels[i]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AreaSpark({ values, color = "#14b8a6" }: { values: number[]; color?: string }) {
  const max = Math.max(30, ...values);
  const n = values.length;
  const pts = values.map((v, i) => `${n === 1 ? 50 : (i / (n - 1)) * 100},${38 - (v / max) * 33}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L100,40 L0,40 Z`;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
      <defs>
        <linearGradient id={`focusFill-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#focusFill-${color.slice(1)})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </svg>
  );
}

function MiniStat({ big, sub, accent }: { big: string; sub: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2.5">
      <p className={cn("text-lg font-bold leading-none tabular-nums", accent)}>{big}</p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{sub}</p>
    </div>
  );
}

function HeatCell({ v }: { v: number }) {
  return (
    <div
      className={cn(
        "h-[6px] w-[6px] rounded-[2px]",
        v === 0 && "bg-muted-foreground/10",
        v === 1 && "bg-violet-500/35",
        v === 2 && "bg-violet-500/60",
        v === 3 && "bg-violet-500/85",
        v === 4 && "bg-violet-500"
      )}
    />
  );
}

// ─── Asosiy komponent ────────────────────────────────────────────────────────

export default function AnalyticsView() {
  const { t, lang } = useUlos();
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const habitLogs = useStore((s) => s.habitLogs);
  const timeEntries = useStore((s) => s.timeEntries);
  const expenses = useStore((s) => s.expenses);
  const notes = useStore((s) => s.notes);
  const budget = useStore((s) => s.settings.financeBudget);

  const [mode, setMode] = useState<Mode>("week");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(-1);

  const data = useMemo(
    () => computePeriod(mode, offset, lang, { tasks, habits, habitLogs, timeEntries, expenses, notes }),
    [mode, offset, lang, tasks, habits, habitLogs, timeEntries, expenses, notes]
  );
  const prev = useMemo(
    () => computePeriod(mode, offset - 1, lang, { tasks, habits, habitLogs, timeEntries, expenses, notes }),
    [mode, offset, lang, tasks, habits, habitLogs, timeEntries, expenses, notes]
  );

  const score = useMemo(() => lifeScore(data, budget), [data, budget]);
  const scoreWord = score >= 75 ? t("ana.score.great") : score >= 50 ? t("ana.score.good") : t("ana.score.low");
  const habitPct = data.habitExpected > 0 ? Math.round((data.habitActual / data.habitExpected) * 100) : 0;
  const focusPerDay = Math.round(data.focusMin / data.days);

  const catRows = useMemo(
    () => Object.entries(data.byCat).sort((a, b) => b[1] - a[1]).slice(0, 4),
    [data.byCat]
  );
  const maxCat = catRows.length ? catRows[0][1] : 1;

  // T0 tahlil qoidalari
  const insights = useMemo(() => {
    const ins: { icon: React.ReactNode; text: string }[] = [];
    const rate = data.completion;
    if (data.done + data.missed > 0) {
      if (rate >= 0.8) ins.push({ icon: <Flame className="h-3.5 w-3.5" />, text: t("ana.in.rateHigh") });
      else if (rate >= 0.6) ins.push({ icon: <TrendingUp className="h-3.5 w-3.5" />, text: t("ana.in.rateMid") });
      else ins.push({ icon: <Lightbulb className="h-3.5 w-3.5" />, text: t("ana.in.rateLow") });
    }
    if (prev.done + prev.missed > 0) {
      const diff = Math.round((rate - prev.completion) * 100);
      if (diff >= 5) ins.push({ icon: <TrendingUp className="h-3.5 w-3.5" />, text: t("ana.in.trendUp", { d: diff }) });
      else if (diff <= -5) ins.push({ icon: <Lightbulb className="h-3.5 w-3.5" />, text: t("ana.in.trendDown", { d: Math.abs(diff) }) });
    }
    if (mode !== "year") {
      const best = data.buckets.reduce((bi, b, i) => (b.done > (data.buckets[bi]?.done ?? 0) ? i : bi), 0);
      if ((data.buckets[best]?.done ?? 0) >= 2) {
        const d = new Date(data.buckets[best].key + "T12:00");
        ins.push({ icon: <CalendarCheck className="h-3.5 w-3.5" />, text: t("ana.in.bestDay", { d: fmtWeekday(d, lang) }) });
      }
    }
    const topH = [...data.habits].sort((a, b) => b.pct - a.pct)[0];
    if (topH && topH.pct >= 0.5) {
      ins.push({ icon: <CalendarCheck className="h-3.5 w-3.5" />, text: t("ana.in.topHabit", { h: `${topH.emoji} ${topH.title}`, p: Math.round(topH.pct * 100) }) });
    }
    if (catRows.length) {
      ins.push({ icon: <Wallet className="h-3.5 w-3.5" />, text: t("ana.in.topCat", { c: t(`cat.${catRows[0][0]}`), p: Math.round((catRows[0][1] / Math.max(1, data.spent)) * 100) }) });
    }
    if (data.focusMin >= 30 && mode !== "year") {
      const bestF = data.buckets.reduce((bi, b, i) => (b.focus > (data.buckets[bi]?.focus ?? 0) ? i : bi), 0);
      const bf = data.buckets[bestF];
      if (bf && bf.focus >= 30) {
        const d = new Date(bf.key + "T12:00");
        ins.push({ icon: <Brain className="h-3.5 w-3.5" />, text: t("ana.in.focusBest", { d: mode === "week" ? fmtWeekday(d, lang) : fmtShortDate(d, lang), m: fmtMinutes(bf.focus, t) }) });
      }
    } else if (data.focusMin === 0) {
      ins.push({ icon: <Brain className="h-3.5 w-3.5" />, text: t("ana.in.noFocus") });
    }
    if (mode === "week") {
      const wd = data.buckets.slice(0, 5).reduce((a, b) => a + b.done, 0) / 5;
      const we = data.buckets.slice(5).reduce((a, b) => a + b.done, 0) / 2;
      if (wd >= 1 && we < wd * 0.5) ins.push({ icon: <Lightbulb className="h-3.5 w-3.5" />, text: t("ana.in.weekendDrop") });
    }
    return ins.slice(0, 5);
  }, [data, prev, mode, catRows, lang, t]);

  // Yillik heatmap: kunlik faollik
  const heat = useMemo(() => {
    if (mode !== "year") return [];
    const { start, end } = periodRange("year", offset);
    const doneByDay = new Map<string, number>();
    const habByDay = new Map<string, number>();
    for (const tk of tasks) {
      if (tk.status === "done" && tk.completedAt) {
        const k = tk.completedAt.slice(0, 10);
        doneByDay.set(k, (doneByDay.get(k) ?? 0) + 1);
      }
    }
    for (const l of habitLogs) {
      if (l.value > 0) habByDay.set(l.date, (habByDay.get(l.date) ?? 0) + l.value);
    }
    const cells: { k: string; v: number }[] = [];
    for (let d = startOfWeek(start); d <= end; d = addDays(d, 1)) {
      const k = dateKey(d);
      if (k > dateKey(new Date())) break;
      const v = (doneByDay.get(k) ?? 0) + (habByDay.get(k) ?? 0) * 0.5;
      cells.push({ k, v: v === 0 ? 0 : v <= 1 ? 1 : v <= 2.5 ? 2 : v <= 4.5 ? 3 : 4 });
    }
    return cells;
  }, [mode, offset, tasks, habitLogs]);

  const hasAnyData = data.done + data.missed + data.habitActual + data.spent + data.focusMin + data.notesCreated > 0;

  // Yillik "Wrapped" uchun
  const bestMonthIdx = useMemo(() => {
    if (mode !== "year") return -1;
    return data.buckets.reduce((bi, b, i) => (b.done + b.habits * 0.5 > data.buckets[bi].done + data.buckets[bi].habits * 0.5 ? i : bi), 0);
  }, [mode, data]);

  const barLabels = useMemo(
    () =>
      data.buckets.map((b) => {
        if (mode !== "month") return b.label;
        const day = Number(b.label);
        return day === 1 || day % 5 === 0 ? b.label : "";
      }),
    [data.buckets, mode]
  );
  const selBucket = selected >= 0 ? data.buckets[selected] : null;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* ─── Boshqaruv: davr tanlash ─── */}
      <SectionCard className="border-violet-500/15 bg-gradient-to-b from-violet-500/[0.05] to-transparent">
        <div className="mb-3 flex items-center gap-1">
          <button
            onClick={() => { setOffset((o) => o - 1); setSelected(-1); }}
            aria-label={t("ana.prev")}
            className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 flex-col items-center">
            <p className="text-sm font-bold leading-tight">{data.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {data.days} {lang === "ru" ? "дн." : lang === "en" ? "days" : "kun"}
            </p>
          </div>
          <button
            onClick={() => { setOffset((o) => Math.min(0, o + 1)); setSelected(-1); }}
            disabled={offset === 0}
            aria-label={t("ana.next")}
            className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Segmented
          items={[
            { value: "week", label: t("ana.week") },
            { value: "month", label: t("ana.month") },
            { value: "year", label: t("ana.year") },
          ]}
          value={mode}
          onChange={(m) => { setMode(m); setOffset(0); setSelected(-1); }}
        />
      </SectionCard>

      {!hasAnyData ? (
        <SectionCard>
          <EmptyState icon={<BarChart3 className="h-5 w-5" />} title={t("ana.noData")} hint={t("empty.honest")} />
        </SectionCard>
      ) : (
        <>
          {/* ─── Life Score — gradient halqa + mini-statlar ─── */}
          <SectionCard className="relative overflow-hidden border-violet-500/20">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(139,92,246,0.10) 1px, transparent 0)",
                backgroundSize: "14px 14px",
              }}
            />
            <div className="relative flex items-center gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <ScoreRing score={score} />
                <span className="text-[11px] font-semibold text-muted-foreground">{t("ana.score")}</span>
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                <MiniStat big={String(data.done)} sub={t("ana.stat.done")} accent="text-emerald-500" />
                <MiniStat big={`${Math.round(rate_pct(data.completion))}%`} sub={t("ana.completion")} accent="text-violet-500" />
                <MiniStat big={fmtMinutes(data.focusMin, t)} sub={t("ana.stat.focus")} accent="text-teal-500" />
                <MiniStat big={`${habitPct}%`} sub={t("ana.stat.habits")} accent="text-amber-500" />
              </div>
            </div>
            <div className="relative mt-3 flex items-center justify-center">
              <Chip
                className={cn(
                  "px-3 py-1",
                  score >= 75
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : score >= 50
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                {scoreWord}
              </Chip>
            </div>
          </SectionCard>

          {/* ─── Vazifalar dinamikasi ─── */}
          <SectionCard>
            <SectionHead
              icon={<BarChart3 className="h-4 w-4" />}
              title={t("ana.tasksDyn")}
              sub={t("ana.tapHint")}
              accent="text-emerald-500"
              right={
                <div className="flex flex-col items-end gap-1">
                  <Chip className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {data.done} ↑
                  </Chip>
                  <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    {data.missed} ↓
                  </Chip>
                </div>
              }
            />
            <StackBars buckets={data.buckets} labels={barLabels} selected={selected} onSelect={setSelected} />
            <div className="mt-3 rounded-2xl bg-muted/50 px-3 py-2.5">
              {selBucket ? (
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold">
                    {mode === "year"
                      ? monthName(Number(selBucket.key), lang)
                      : selBucket.key.length === 10
                        ? fmtShortDate(new Date(selBucket.key + "T12:00"), lang)
                        : selBucket.label}
                    :
                  </span>{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">{selBucket.done} {t("ana.stat.done")}</span>
                  {" · "}
                  <span className="text-rose-500">{selBucket.missed} {t("ana.stat.missed")}</span>
                  {" · "}
                  <span className="text-teal-600 dark:text-teal-400">{fmtMinutes(selBucket.focus, t)} {t("ana.stat.focus")}</span>
                  {selBucket.spent > 0 && (
                    <>
                      {" · "}
                      <span className="text-amber-600 dark:text-amber-400">{fmtMoney(selBucket.spent)}</span>
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("ana.completion")}: <span className="font-bold text-foreground">{Math.round(rate_pct(data.completion))}%</span>
                  {" · "}{t("ana.focusPerDay")}: <span className="font-bold text-foreground">{focusPerDay} min</span>
                  {" · "}{t("ana.stat.active")}: <span className="font-bold text-foreground">{data.activeDays}</span>
                </p>
              )}
            </div>
          </SectionCard>

          {/* ─── Fokus tendensiyasi ─── */}
          <SectionCard>
            <SectionHead
              icon={<Brain className="h-4 w-4" />}
              title={t("ana.focusTrend")}
              accent="text-teal-500"
              right={
                <Chip className="border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300">
                  {fmtMinutes(data.focusMin, t)}
                </Chip>
              }
            />
            <AreaSpark values={data.buckets.map((b) => Math.round(b.focus))} />
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/60">
              <span>{data.buckets[0]?.label}</span>
              <span>{data.buckets[data.buckets.length - 1]?.label}</span>
            </div>
          </SectionCard>

          {/* ─── Odatlar barqarorligi ─── */}
          {data.habits.length > 0 && (
            <SectionCard>
              <SectionHead
                icon={<CalendarCheck className="h-4 w-4" />}
                title={t("ana.habitsTitle")}
                accent="text-amber-500"
                sub={t("ana.streakBest", { n: Math.max(...data.habits.map((h) => h.streak), 0) })}
              />
              <div className="flex flex-col gap-3">
                {data.habits.map((h) => (
                  <div key={h.id} className="flex items-center gap-2.5">
                    <span className="w-7 shrink-0 text-center text-base">{h.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs font-medium">{h.title}</p>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                          {Math.round(h.pct * 100)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(3, h.pct * 100)}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          className={cn("h-full rounded-full", HABIT_COLORS[h.color]?.bg ?? "bg-violet-500")}
                        />
                      </div>
                    </div>
                    {h.streak >= 3 && (
                      <Chip className="shrink-0 border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Flame className="h-3 w-3" /> {h.streak}
                      </Chip>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ─── Moliya oqimi ─── */}
          {data.spent > 0 && (
            <SectionCard>
              <SectionHead
                icon={<PieChart className="h-4 w-4" />}
                title={t("ana.financeTitle")}
                accent="text-rose-500"
                right={
                  <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    {fmtMoney(data.spent)} {t("fin.currency")}
                  </Chip>
                }
              />
              <div className="mb-3">
                <div className="mb-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
                  <span>{t("ana.budgetOf", { b: fmtMoney(budget * (data.days / 30)) })}</span>
                  <span className="font-bold text-foreground">{Math.round((data.spent / Math.max(1, budget * (data.days / 30))) * 100)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${clamp((data.spent / Math.max(1, budget * (data.days / 30))) * 100, 2, 100)}%`,
                    }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "h-full rounded-full",
                      data.spent > budget * (data.days / 30) ? "bg-rose-500" : "bg-emerald-500"
                    )}
                  />
                </div>
              </div>
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">{t("ana.byCat")}</p>
              <div className="flex flex-col gap-2.5">
                {catRows.map(([cat, amt]) => (
                  <div key={cat} className="flex items-center gap-2.5">
                    <span className="w-6 shrink-0 text-center text-base">{CATEGORY_ICON[cat]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-medium">{t(`cat.${cat}`)}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtMoney(amt)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(amt / maxCat) * 100}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className={cn("h-full rounded-full", CAT_COLOR[cat] ?? "bg-zinc-400")}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ─── Yillik rejim: Wrapped + heatmap ─── */}
          {mode === "year" && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="brand-grad relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-violet-500/20"
              >
                <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-cyan-300/25 blur-2xl" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/75">{t("ana.wrapped")}</p>
                <h2 className="mt-0.5 text-xl font-bold leading-snug">
                  {t("ana.wrappedYear", { y: data.start.getFullYear() })}
                </h2>
                <p className="mt-3 text-5xl font-black leading-none tabular-nums">{data.done}</p>
                <p className="mt-1 text-sm text-white/85">{t("ana.w.tasks")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-lg font-bold leading-none tabular-nums">{Math.round(data.focusMin / 60)}</p>
                    <p className="mt-1 text-[10px] text-white/75">{t("ana.w.focusH")}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-lg font-bold leading-none tabular-nums">{Math.round(data.habitActual)}</p>
                    <p className="mt-1 text-[10px] text-white/75">{t("ana.w.habitLogs")}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-lg font-bold leading-none tabular-nums">{data.notesCreated}</p>
                    <p className="mt-1 text-[10px] text-white/75">{t("ana.w.notes")}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm">
                    <p className="text-lg font-bold leading-none tabular-nums">{data.activeDays}</p>
                    <p className="mt-1 text-[10px] text-white/75">{t("ana.stat.active")}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {data.done + data.missed > 0 && (
                    <Chip className="border-white/25 bg-white/15 text-white">
                      <CheckCircle2 className="h-3 w-3" /> {Math.round(rate_pct(data.completion))}% {t("ana.w.completion")}
                    </Chip>
                  )}
                  {bestMonthIdx >= 0 && (
                    <Chip className="border-white/25 bg-white/15 text-white">
                      <Flame className="h-3 w-3" /> {t("ana.w.bestMonth", { m: monthName(bestMonthIdx, lang) })}
                    </Chip>
                  )}
                  {catRows.length > 0 && (
                    <Chip className="border-white/25 bg-white/15 text-white">
                      <Wallet className="h-3 w-3" /> {t("ana.w.topCat", { c: t(`cat.${catRows[0][0]}`) })}
                    </Chip>
                  )}
                </div>
              </motion.div>

              {heat.length > 0 && (
                <SectionCard>
                  <SectionHead
                    icon={<BarChart3 className="h-4 w-4" />}
                    title={t("ana.heatmap")}
                    sub={t("ana.heatmapHint")}
                    accent="text-violet-500"
                  />
                  <div className="thin-scroll overflow-x-auto pb-1">
                    <div
                      className="grid"
                      style={{
                        gridTemplateRows: "repeat(7, 6px)",
                        gridAutoFlow: "column",
                        gap: "1.5px",
                      }}
                    >
                      {heat.map((c) => (
                        <HeatCell key={c.k} v={c.v} />
                      ))}
                    </div>
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* ─── T0 tahlili — shaffof qoidalar ─── */}
          <SectionCard className="border-teal-500/15 bg-gradient-to-b from-teal-500/[0.04] to-transparent">
            <SectionHead
              icon={<Lightbulb className="h-4 w-4" />}
              title={t("ana.insights")}
              sub={t("ana.insightsSub")}
              accent="text-teal-500"
              right={<Chip className="border-teal-500/25 bg-teal-500/10 text-[9px] text-teal-600 dark:text-teal-300">T0 · {t("app.offlineBadge")}</Chip>}
            />
            {insights.length === 0 ? (
              <p className="rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">{t("ana.in.empty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {insights.map((it, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-2.5 rounded-2xl bg-muted/50 px-3 py-2.5"
                  >
                    <span className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400">{it.icon}</span>
                    <p className="text-xs leading-relaxed">{it.text}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function rate_pct(v: number): number {
  return clamp(v * 100, 0, 100);
}
