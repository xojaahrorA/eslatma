"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip, Ring, EmptyState, Segmented, deleteWithUndo } from "./kit";
import { addDays, dateKey, HABIT_COLORS, startOfDay, startOfWeek } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import type { Goal, GoalType, HabitColor } from "@/lib/types";
import { motion } from "framer-motion";
import {
  Compass,
  Crosshair,
  Flag,
  Plus,
  Repeat2,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

const GOAL_TYPE_META: Record<GoalType, { color: string; ring: string; chip: string; icon: typeof Flag }> = {
  outcome: { color: "text-teal-600 dark:text-teal-400", ring: "stroke-teal-500", chip: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300", icon: Flag },
  process: { color: "text-violet-600 dark:text-violet-400", ring: "stroke-violet-500", chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: Repeat2 },
  boundary: { color: "text-rose-600 dark:text-rose-400", ring: "stroke-rose-500", chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", icon: Crosshair },
};

export default function GoalsView() {
  const { t } = useUlos();
  const [tab, setTab] = useState<"goals" | "habits">("goals");
  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      <Segmented
        items={[
          { value: "goals", label: t("goals.tabGoals") },
          { value: "habits", label: t("goals.tabHabits") },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "goals" ? <GoalsList /> : <HabitsList />}
    </div>
  );
}

// ─── Maqsadlar ──────────────────────────────────────────────────────────────

function GoalsList() {
  const { t } = useUlos();
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const bumpGoal = useStore((s) => s.bumpGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", type: "outcome" as GoalType, target: 10, unit: "", deadline: "" });

  const submit = () => {
    if (!form.title.trim()) return;
    addGoal({
      title: form.title.trim(),
      type: form.type,
      target: Math.max(1, form.target),
      unit: form.unit || (form.type === "outcome" ? "x" : "marta"),
      deadline: form.deadline || undefined,
    });
    setAdding(false);
    setForm({ title: "", type: "outcome", target: 10, unit: "", deadline: "" });
    import("sonner").then(({ toast }) => toast(t("goals.new")));
  };

  return (
    <>
      <button
        onClick={() => setAdding(true)}
        className="brand-grad flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("goals.new")}
      </button>

      {goals.filter((g) => !g.archived).length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title={t("goals.empty")} hint={t("goals.typeHint.outcome")} />
      ) : (
        goals
          .filter((g) => !g.archived)
          .map((g) => <GoalCard key={g.id} goal={g} />)
      )}

      {/* maqsad qo'shish dialogi */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAdding(false)}>
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <h3 className="mb-4 text-base font-bold">{t("goals.new")}</h3>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("tasks.titleField")}
              className="mb-3 w-full rounded-2xl bg-muted px-4 py-3 text-sm outline-none"
            />
            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {(Object.keys(GOAL_TYPE_META) as GoalType[]).map((ty) => (
                <button
                  key={ty}
                  onClick={() => setForm({ ...form, type: ty })}
                  className={cn(
                    "rounded-2xl border p-2.5 text-center transition-all active:scale-95",
                    form.type === ty ? GOAL_TYPE_META[ty].chip : "border-border bg-card text-muted-foreground"
                  )}
                >
                  <p className="text-xs font-bold">{t(`goals.type.${ty}`)}</p>
                  <p className="mt-0.5 text-[9px] leading-tight opacity-75">{t(`goals.typeHint.${ty}`)}</p>
                </button>
              ))}
            </div>
            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-muted-foreground">{t("goals.target")}</label>
                <input
                  type="number"
                  min={1}
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                  className="w-full rounded-2xl bg-muted px-4 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-[11px] text-muted-foreground">{t("goals.unit")}</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="kitob…"
                  className="w-full rounded-2xl bg-muted px-4 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
            <label className="mb-1 block text-[11px] text-muted-foreground">{t("goals.deadline")}</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="mb-4 w-full rounded-2xl bg-muted px-4 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
                {t("common.cancel")}
              </button>
              <button onClick={submit} className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white">
                {t("common.add")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { t } = useUlos();
  const bumpGoal = useStore((s) => s.bumpGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);
  const meta = GOAL_TYPE_META[goal.type];
  const Icon = meta.icon;
  const pct = goal.target > 0 ? goal.current / goal.target : 0;
  const step = Math.max(1, Math.round(goal.target / 10));

  const daysLeft = goal.deadline
    ? Math.round((new Date(goal.deadline + "T23:59").getTime() - Date.now()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border bg-card p-4"
    >
      <div className="flex items-start gap-3.5">
        <Ring value={pct} size={72} stroke={8} colorClass={meta.ring}>
          <div className="text-center">
            <span className="block text-sm font-bold">{Math.round(pct * 100)}%</span>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <Chip className={meta.chip}>
              <Icon className="h-3 w-3" /> {t(`goals.type.${goal.type}`)}
            </Chip>
            {daysLeft !== null && (
              <Chip className={daysLeft < 7 ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border bg-secondary"}>
                {daysLeft >= 0 ? t("goals.left", { d: daysLeft }) : t("goals.noDeadline")}
              </Chip>
            )}
          </div>
          <h3 className="text-sm font-bold leading-snug">{goal.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("goals.progress", { c: goal.current, t: goal.target, u: goal.unit ?? "" })}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => bumpGoal(goal.id, step)}
          className="flex-1 rounded-xl bg-muted py-2 text-xs font-semibold transition-transform active:scale-95 hover:bg-accent"
        >
          +{step}
        </button>
        <button
          onClick={() => bumpGoal(goal.id, -step)}
          className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold transition-transform active:scale-95 hover:bg-accent"
        >
          −{step}
        </button>
        <button
          onClick={() =>
            deleteWithUndo(() => deleteGoal(goal.id), snapshot, restore, t, "undo.goalDelete")
          }
          aria-label={t("common.delete")}
          className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Odatlar: yumshoq ketma-ketlik (PRD 4.3) ────────────────────────────────

function HabitsList() {
  const { t } = useUlos();
  const habits = useStore((s) => s.habits);
  const habitLogs = useStore((s) => s.habitLogs);
  const addHabit = useStore((s) => s.addHabit);
  const logHabit = useStore((s) => s.logHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", emoji: "✨", perWeek: 7, color: "orange" as HabitColor });

  const EMOJIS = ["💧", "📖", "🏃", "🧘", "💪", "🎸", "🌱", "☀️", "🧠", "💻"];
  const todayStr = dateKey(new Date());

  const submit = () => {
    if (!form.title.trim()) return;
    addHabit({ title: form.title.trim(), emoji: form.emoji, perWeek: form.perWeek, color: form.color });
    setAdding(false);
    setForm({ title: "", emoji: "✨", perWeek: 7, color: "orange" });
    import("sonner").then(({ toast }) => toast(t("habits.new")));
  };

  /** Yumshoq ketma-ketlik: haftada 2 ta qalqon — uzilish ketma-ketlikni nolga tushirmaydi */
  const computeStreak = (habitId: string) => {
    const logs = new Map(habitLogs.filter((l) => l.habitId === habitId).map((l) => [l.date, l.value]));
    let streak = 0;
    let shieldsUsed = 0;
    for (let i = 0; i < 90; i++) {
      const d = addDays(startOfDay(new Date()), -i);
      const k = dateKey(d);
      const v = logs.get(k) ?? 0;
      if (v > 0) streak++;
      else if (i === 0) continue; // bugun hali tugamagan
      else if (shieldsUsed < 2) shieldsUsed++; // qalqon ishlatildi
      else break;
    }
    return streak;
  };

  const weekMisses = (habitId: string) => {
    const ws = startOfWeek(new Date());
    const today = new Date();
    let misses = 0;
    for (let d = new Date(ws); d < today; d = addDays(d, 1)) {
      const k = dateKey(d);
      const v = habitLogs.find((l) => l.habitId === habitId && l.date === k)?.value ?? 0;
      if (v === 0) misses++;
    }
    return misses;
  };

  return (
    <>
      <div className="flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3">
        <Shield className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">{t("habits.softStreak")}:</span>{" "}
          {t("q2.hint")}
        </p>
      </div>

      <button
        onClick={() => setAdding(true)}
        className="brand-grad flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("habits.new")}
      </button>

      {habits.filter((h) => !h.archived).length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-5 w-5" />} title={t("habits.empty")} />
      ) : (
        habits
          .filter((h) => !h.archived)
          .map((h) => {
            const c = HABIT_COLORS[h.color] ?? HABIT_COLORS.orange;
            const todayVal = habitLogs.find((l) => l.habitId === h.id && l.date === todayStr)?.value ?? 0;
            const streak = computeStreak(h.id);
            const shieldsLeft = 2 - weekMisses(h.id);
            const yesterdayMissed =
              (habitLogs.find((l) => l.habitId === h.id && l.date === dateKey(addDays(new Date(), -1)))?.value ?? 0) === 0;

            return (
              <motion.div key={h.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => logHabit(h.id, todayStr, todayVal > 0 ? 0 : 1)}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl transition-all active:scale-90",
                      todayVal > 0 ? c.bg + " shadow-lg " + c.soft : c.soft
                    )}
                    aria-label={t("habits.markDone")}
                  >
                    {h.emoji}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold">{h.title}</h3>
                      {todayVal > 0 && <Chip className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">✓</Chip>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {h.perWeek >= 7 ? t("habits.daily") : `${h.perWeek} ${t("habits.perWeek")}`}
                      {" · "}
                      <span className={cn("font-semibold", c.text)}>
                        🔥 {streak} {t("habits.streak")}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => deleteWithUndo(() => deleteHabit(h.id), snapshot, restore, t, "undo.habitDelete")}
                    aria-label={t("common.delete")}
                    className="rounded-xl p-2 text-muted-foreground/60 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 7 kun nuqtalari */}
                <div className="mt-3 flex items-center justify-between gap-1">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = addDays(startOfWeek(new Date()), i);
                    const k = dateKey(d);
                    const v = habitLogs.find((l) => l.habitId === h.id && l.date === k)?.value ?? 0;
                    const future = d > new Date();
                    const isToday = k === todayStr;
                    const recovery = v > 0 && isToday && yesterdayMissed;
                    return (
                      <div key={k} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[9px] text-muted-foreground">
                          {new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(d)}
                        </span>
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border text-[9px] transition-all",
                            v > 0
                              ? c.bg + " border-transparent text-white"
                              : v === 0.5
                                ? "border-amber-400 bg-amber-400/30"
                                : future
                                  ? "border-dashed border-border"
                                  : "border-border bg-muted/50",
                            isToday && "ring-2 ring-offset-1 ring-offset-card ring-violet-500/50",
                            recovery && "pulse-soft ring-2 ring-amber-400/70"
                          )}
                        >
                          {v === 0.5 && "↻"}
                          {recovery && "↻"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Shield className={cn("h-3 w-3", shieldsLeft > 0 ? "text-amber-500" : "text-muted-foreground/40")} />
                    {t("habits.shieldLeft", { n: Math.max(0, shieldsLeft) })}
                  </p>
                  {yesterdayMissed && todayVal === 0 && (
                    <Chip className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      ↻ {t("habits.recovery")}
                    </Chip>
                  )}
                </div>
              </motion.div>
            );
          })
      )}

      {/* odat qo'shish */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAdding(false)}>
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <h3 className="mb-4 text-base font-bold">{t("habits.new")}</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setForm({ ...form, emoji: e })}
                  className={cn(
                    "h-10 w-10 rounded-2xl text-lg transition-all active:scale-90",
                    form.emoji === e ? "bg-violet-500/20 ring-2 ring-violet-500" : "bg-muted"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("tasks.titleField")}
              className="mb-3 w-full rounded-2xl bg-muted px-4 py-3 text-sm outline-none"
            />
            <label className="mb-1.5 block text-[11px] text-muted-foreground">
              {form.perWeek >= 7 ? t("habits.daily") : `${form.perWeek} ${t("habits.perWeek")}`}
            </label>
            <input
              type="range"
              min={1}
              max={7}
              value={form.perWeek}
              onChange={(e) => setForm({ ...form, perWeek: Number(e.target.value) })}
              className="mb-3 w-full accent-violet-500"
            />
            <div className="mb-4 flex gap-1.5">
              {(Object.keys(HABIT_COLORS) as HabitColor[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    "h-8 w-8 rounded-full transition-all active:scale-90",
                    HABIT_COLORS[c].bg,
                    form.color === c && "ring-2 ring-offset-2 ring-offset-popover ring-foreground"
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
                {t("common.cancel")}
              </button>
              <button onClick={submit} className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white">
                {t("common.add")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
