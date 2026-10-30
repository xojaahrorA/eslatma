"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useUlos, TaskRow, SectionCard, SectionHead, Chip, Ring, EmptyState } from "./kit";
import {
  dateKey,
  startOfDay,
  fmtLongDate,
  HABIT_COLORS,
  PRIORITY_STYLE,
  fmtMinutes,
} from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Flame,
  ListTodo,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Wind,
} from "lucide-react";
import type { Task } from "@/lib/types";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { t, lang, startFocus, navigate } = useUlos();
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const habitLogs = useStore((s) => s.habitLogs);
  const goals = useStore((s) => s.goals);
  const timeEntries = useStore((s) => s.timeEntries);
  const settings = useStore((s) => s.settings);
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const logHabit = useStore((s) => s.logHabit);

  const today = startOfDay(new Date());
  const todayStr = dateKey(today);

  // ─── ma'lumotlar ───
  const isToday = (task: Task) => task.dueAt && task.dueAt.slice(0, 10) === todayStr;
  const isPast = (task: Task) => task.dueAt && task.dueAt.slice(0, 10) < todayStr;
  const active = (task: Task) => task.status !== "done" && task.status !== "cancelled";

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((x) => (isToday(x) || (x.status === "in_progress" && !x.dueAt)) && active(x))
        .sort((a, b) => {
          if (a.dueAt && b.hasTime && b.dueAt) return (a.dueAt > b.dueAt ? 1 : -1) * (a.hasTime ? 1 : 1);
          if (a.dueAt && !b.dueAt) return -1;
          if (!a.dueAt && b.dueAt) return 1;
          const pr = { critical: 0, high: 1, medium: 2, low: 3 };
          return pr[a.priority] - pr[b.priority];
        }),
    [tasks, todayStr]
  );

  const overdue = useMemo(
    () =>
      tasks.filter((x) => {
        const d = x.dueAt?.slice(0, 10) ?? "";
        const recent = d === "" || d >= dateKey(new Date(Date.now() - 3 * 86400000));
        return recent && ((isPast(x) && active(x)) || x.status === "missed");
      }),
    [tasks, todayStr]
  );

  const hero = useMemo(() => {
    const pr = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const pool = tasks.filter(active);
    const scored = pool
      .map((x) => ({
        x,
        score:
          pr[x.priority] * 10 +
          (isToday(x) ? 0 : isPast(x) ? -1 : 5) +
          (x.status === "in_progress" ? -3 : 0),
      }))
      .sort((a, b) => a.score - b.score);
    return scored[0]?.x ?? null;
  }, [tasks, todayStr]);

  const doneToday = tasks.filter((x) => x.status === "done" && x.completedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const focusMinToday = timeEntries
    .filter((e) => e.mode === "focus" && e.start.slice(0, 10) === todayStr)
    .reduce((acc, e) => acc + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0);
  const habitsDoneToday = habits.filter((h) => habitLogs.some((l) => l.habitId === h.id && l.date === todayStr && l.value > 0)).length;

  const hour = new Date().getHours();
  const greet = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* ─── Salom header — gradient ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="brand-grad relative overflow-hidden rounded-3xl p-5 text-white"
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
        <p className="text-sm font-medium text-white/85">
          {t(`greet.${greet}`)}
          {settings.userName ? `, ${settings.userName}` : ""} 👋
        </p>
        <h1 className="mt-0.5 text-xl font-bold">{fmtLongDate(today, lang)}</h1>
        <p className="mt-1 text-xs text-white/70">{t("dash.subtitle")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip className="border-white/25 bg-white/15 text-white">
            <CheckCircle2 className="h-3 w-3" /> {doneToday} {t("nav.tasks")}
          </Chip>
          <Chip className="border-white/25 bg-white/15 text-white">
            <Target className="h-3 w-3" /> {fmtMinutes(focusMinToday, t)} {t("dash.stats.focus")}
          </Chip>
          <Chip className="border-white/25 bg-white/15 text-white">
            <Flame className="h-3 w-3" /> {habitsDoneToday}/{habits.length}
          </Chip>
          <Chip
            className="ml-auto border-white/40 bg-white/20 font-semibold text-white"
            onClick={() => navigate("analytics")}
          >
            <BarChart3 className="h-3 w-3" /> {t("more.analytics")} <ArrowRight className="h-3 w-3" />
          </Chip>
        </div>
      </motion.div>

      {/* ─── 1-savol: Kun lentasi ─── */}
      <SectionCard>
        <SectionHead
          icon={<ListTodo className="h-4 w-4" />}
          title={t("q1.title")}
          sub={t("q1.subtitle")}
          accent="text-violet-500"
          right={
            <Chip className="bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/25" onClick={() => navigate("tasks")}>
              {t("common.all")} <ArrowRight className="h-3 w-3" />
            </Chip>
          }
        />
        {todayTasks.length === 0 ? (
          <EmptyState icon={<Wind className="h-5 w-5" />} title={t("q1.empty")} />
        ) : (
          <div className="relative">
            <div className="absolute bottom-4 left-[26px] top-4 w-px bg-border" />
            <div className="flex flex-col gap-2">
              {todayTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="relative">
                  <span
                    className={cn(
                      "absolute left-[9px] top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-4 ring-card",
                      PRIORITY_STYLE[task.priority].dot
                    )}
                  />
                  <div className="pl-6">
                    <TaskRow task={task} compact />
                  </div>
                </div>
              ))}
            </div>
            {todayTasks.length > 6 && (
              <button
                onClick={() => navigate("tasks")}
                className="mt-2 w-full rounded-xl bg-muted py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                +{todayTasks.length - 6} {t("common.all")}
              </button>
            )}
          </div>
        )}
      </SectionCard>

      {/* ─── 2-savol: Nima bajarilmay qoldi — Jazolamaslik ─── */}
      <SectionCard className="border-rose-500/15 bg-gradient-to-b from-rose-500/[0.04] to-transparent">
        <SectionHead
          icon={<RotateCcw className="h-4 w-4" />}
          title={t("q2.title")}
          sub={t("q2.subtitle")}
          accent="text-rose-500"
        />
        {overdue.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/[0.07] p-3">
            <span className="rounded-xl bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium">{t("q2.empty")}</p>
              <p className="text-xs text-muted-foreground">{t("q2.hint")}</p>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">{t("q2.gentle")}</p>
            <div className="flex flex-col gap-2">
              {overdue.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-2xl border bg-card/60 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {task.status === "missed"
                        ? t(`reason.${task.missReason ?? "other"}`)
                        : t("tasks.groupOverdue")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setHours(18, 0, 0, 0);
                      const iso = `${todayStr}T18:00`;
                      setTaskStatus(task.id, "todo");
                      useStore.getState().updateTask(task.id, { dueAt: iso, status: "todo" });
                      import("sonner").then(({ toast }) => toast(t("q2.moveToday")));
                    }}
                    className="shrink-0 rounded-xl bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-600 transition-transform active:scale-95 dark:text-rose-400"
                  >
                    {t("q2.moveToday")}
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      const iso = `${dateKey(d)}T09:00`;
                      setTaskStatus(task.id, "todo");
                      useStore.getState().updateTask(task.id, { dueAt: iso, status: "todo" });
                      import("sonner").then(({ toast }) => toast(t("q2.moveTomorrow")));
                    }}
                    className="shrink-0 rounded-xl bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-transform active:scale-95"
                  >
                    {t("day.tomorrow")}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* ─── 3-savol: Maqsadlar — halqalar ─── */}
      <SectionCard>
        <SectionHead
          icon={<Target className="h-4 w-4" />}
          title={t("q3.title")}
          sub={t("q3.subtitle")}
          accent="text-teal-500"
          right={
            <Chip className="border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300" onClick={() => navigate("goals")}>
              <ArrowRight className="h-3 w-3" />
            </Chip>
          }
        />
        {goals.length === 0 && habits.length === 0 ? (
          <EmptyState icon={<Target className="h-5 w-5" />} title={t("q3.noGoals")} />
        ) : (
          <>
            {goals.length > 0 && (
              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {goals.filter((g) => !g.archived).slice(0, 5).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => navigate("goals")}
                    className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl p-2 transition-colors hover:bg-muted"
                  >
                    <Ring
                      value={g.target > 0 ? g.current / g.target : 0}
                      size={64}
                      stroke={7}
                      colorClass={
                        g.type === "outcome" ? "stroke-teal-500" : g.type === "process" ? "stroke-violet-500" : "stroke-rose-500"
                      }
                    >
                      <span className="text-[13px] font-bold">
                        {g.target > 0 ? Math.round((g.current / g.target) * 100) : 0}%
                      </span>
                    </Ring>
                    <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted-foreground">
                      {g.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {habits.length > 0 && (
              <div className="mt-2 border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t("q3.habitsToday")}</p>
                <div className="flex flex-wrap gap-2">
                  {habits.filter((h) => !h.archived).map((h) => {
                    const done = habitLogs.some((l) => l.habitId === h.id && l.date === todayStr && l.value > 0);
                    return (
                      <button
                        key={h.id}
                        onClick={() => logHabit(h.id, todayStr, done ? 0 : 1)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                          done
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-card text-muted-foreground hover:border-emerald-500/40"
                        )}
                      >
                        <span>{h.emoji}</span> {h.title} {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ─── 4-savol: Bitta fokus — Hero ─── */}
      {hero ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => startFocus(hero.id)}
          className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-card p-4 text-left shadow-lg shadow-violet-500/10 transition-transform active:scale-[0.99]"
        >
          <div className="brand-grad-soft pointer-events-none absolute inset-0" />
          <div className="relative">
            <div className="mb-2 flex items-center justify-between">
              <Chip className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Sparkles className="h-3 w-3" /> {t("q4.subtitle")}
              </Chip>
              <Chip className={PRIORITY_STYLE[hero.priority].chip}>{t(PRIORITY_STYLE[hero.priority].labelKey)}</Chip>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("q4.title")}
            </p>
            <h3 className="mt-1 text-lg font-bold leading-snug">{hero.title}</h3>
            <div className="mt-3 flex items-center gap-2">
              <span className="brand-grad flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold text-white">
                <Play className="h-4 w-4" /> {t("q4.start")}
              </span>
              {hero.dueAt && hero.hasTime && (
                <span className="text-xs text-muted-foreground">{fmtMinutes(hero.estimateMin ?? 0, t)}</span>
              )}
            </div>
          </div>
        </motion.button>
      ) : (
        <SectionCard>
          <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title={t("q4.empty")} />
        </SectionCard>
      )}

      <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        {t("empty.honest")}
      </p>
    </div>
  );
}
