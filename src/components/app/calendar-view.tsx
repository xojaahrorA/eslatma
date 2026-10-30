"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip, EmptyState } from "./kit";
import {
  addDays,
  dateKey,
  fmtWeekday,
  fmtDay,
  fmtTime,
  PRIORITY_STYLE,
  startOfWeek,
  timeToMin,
  parseLocal,
} from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { motion } from "framer-motion";
import { CalendarDays, CalendarX2, Clock, Rows3 } from "lucide-react";

const START_H = 6;
const END_H = 24;
const HOUR_PX = 56;

export default function CalendarView() {
  const { t, lang } = useUlos();
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const [sel, setSel] = useState<Date>(new Date());
  const [resolving, setResolving] = useState<Task | null>(null);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, []);
  const selStr = dateKey(sel);

  const dayTasks = useMemo(
    () =>
      tasks.filter(
        (x) =>
          x.dueAt &&
          x.dueAt.slice(0, 10) === selStr &&
          x.status !== "done" &&
          x.status !== "cancelled"
      ),
    [tasks, selStr]
  );

  const timed = dayTasks
    .filter((x) => x.hasTime)
    .map((x) => {
      const d = parseLocal(x.dueAt);
      const start = d ? d.getHours() * 60 + d.getMinutes() : START_H * 60;
      const dur = Math.max(30, x.estimateMin ?? 60);
      return { task: x, start, dur };
    })
    .filter((x) => x.start >= START_H * 60 && x.start < END_H * 60)
    .sort((a, b) => a.start - b.start);

  // to'qnashuvlar (PRD 4.2)
  const conflictIds = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i], b = timed[j];
      if (a.start < b.start + b.dur && b.start < a.start + a.dur) {
        conflictIds.add(a.task.id);
        conflictIds.add(b.task.id);
      }
    }
  }

  // bo'sh oynalar (≥30 min, 08:00–22:00)
  const freeSlots = useMemo(() => {
    const busy = timed
      .map((x) => [x.start, Math.min(x.start + x.dur, END_H * 60)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const slots: [number, number][] = [];
    let cursor = Math.max(8 * 60, START_H * 60);
    const limit = 22 * 60;
    for (const [s, e] of busy) {
      if (s > cursor && s - cursor >= 30) slots.push([cursor, Math.min(s, limit)]);
      cursor = Math.max(cursor, e);
    }
    if (cursor < limit - 30) slots.push([cursor, limit]);
    return slots.filter(([s, e]) => e > s && e - s >= 30);
  }, [timed]);

  const noTime = dayTasks.filter((x) => !x.hasTime);

  const now = new Date();
  const isToday = selStr === dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const fmtRange = (s: number, e: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}–${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* ─── Hafta lentasi ─── */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {weekDays.map((d) => {
          const k = dateKey(d);
          const active = k === selStr;
          const count = tasks.filter(
            (x) => x.dueAt?.slice(0, 10) === k && x.status !== "done" && x.status !== "cancelled"
          ).length;
          return (
            <button
              key={k}
              onClick={() => setSel(d)}
              className={cn(
                "flex min-w-[52px] flex-1 flex-col items-center gap-1 rounded-2xl border py-2 transition-all active:scale-95",
                active
                  ? "border-transparent brand-grad text-white shadow-lg shadow-violet-500/20"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <span className="text-[10px] font-medium uppercase">{fmtWeekday(d, lang, true)}</span>
              <span className={cn("text-base font-bold", active ? "text-white" : "text-foreground")}>
                {d.getDate()}
              </span>
              <span className="flex h-1.5 gap-0.5">
                {count > 0 && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : "bg-violet-500")} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── To'qnashuv ogohlantirishi ─── */}
      {conflictIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-3"
        >
          <CalendarX2 className="h-5 w-5 shrink-0 text-rose-500" />
          <p className="flex-1 text-xs font-medium text-rose-600 dark:text-rose-300">
            {t("cal.conflictHint", { n: conflictIds.size })}
          </p>
        </motion.div>
      )}

      {/* ─── Timeline ─── */}
      <SectionCard className="p-0" >
        <div className="relative px-3 pb-3 pt-4">
          <div className="relative" style={{ height: (END_H - START_H) * HOUR_PX }}>
            {/* soat panjarasi */}
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 flex gap-2"
                style={{ top: i * HOUR_PX }}
              >
                <span className="w-9 shrink-0 pt-0.5 text-right text-[10px] font-medium text-muted-foreground">
                  {String(START_H + i).padStart(2, "0")}:00
                </span>
                <div className="flex-1 border-t border-border/70" />
              </div>
            ))}

            {/* hozirgi vaqt chizig'i (PRD 4.2) */}
            {isToday && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
              <div
                className="absolute left-9 right-0 z-20 flex items-center"
                style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}
              >
                <span className="h-2.5 w-2.5 -translate-x-1 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
                <div className="h-[2px] flex-1 bg-rose-500" />
                <span className="ml-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {t("cal.now")}
                </span>
              </div>
            )}

            {/* vazifa bloklari */}
            {timed.map(({ task, start, dur }) => {
              const top = ((start - START_H * 60) / 60) * HOUR_PX;
              const height = Math.max(44, (dur / 60) * HOUR_PX - 4);
              const conflict = conflictIds.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => conflict && setResolving(task)}
                  className={cn(
                    "absolute left-12 right-2 z-10 overflow-hidden rounded-xl border-2 p-2 text-left transition-all active:scale-[0.98]",
                    conflict
                      ? "border-rose-500/70 bg-rose-500/[0.08] shadow-lg shadow-rose-500/10"
                      : PRIORITY_STYLE[task.priority].spine.replace("bg-", "border-") + " border-opacity-40 bg-card"
                  )}
                  style={{ top, height }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("text-[10px] font-bold", conflict ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground")}>
                      {fmtTime(task.dueAt, lang)}
                    </span>
                    {conflict && (
                      <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {t("cal.conflict")}
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-0.5 truncate text-xs font-semibold leading-tight", height > 70 && "")}>
                    {task.title}
                  </p>
                  {height > 72 && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {t(PRIORITY_STYLE[task.priority].labelKey)}
                      {task.estimateMin ? ` · ${task.estimateMin}m` : ""}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* ─── Bo'sh oynalar ─── */}
      <SectionCard>
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-teal-500" />
          <h3 className="text-sm font-bold">{t("cal.freeSlots")}</h3>
        </div>
        {freeSlots.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("cal.noFree")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {freeSlots.slice(0, 6).map(([s, e], i) => (
              <Chip key={i} className="border-teal-500/25 bg-teal-500/10 px-3 py-1 text-teal-700 dark:text-teal-300">
                {fmtRange(s, e)}
              </Chip>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Vaqtisz vazifalar ─── */}
      {noTime.length > 0 && (
        <SectionCard>
          <div className="mb-2 flex items-center gap-2">
            <Rows3 className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-bold">{t("cal.allDay")}</h3>
          </div>
          <div className="flex flex-col gap-2">
            {noTime.map((task) => (
              <div key={task.id} className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_STYLE[task.priority].dot)} />
                <p className="flex-1 truncate text-sm">{task.title}</p>
                <span className="text-[10px] text-muted-foreground">{fmtDay(sel, lang)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {dayTasks.length === 0 && (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={t("cal.empty")} />
      )}

      {/* ─── To'qnashuvni hal qilish varaqasi ─── */}
      {resolving && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setResolving(null)}
        >
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <h3 className="mb-1 text-base font-bold">{t("cal.resolve")}</h3>
            <p className="mb-4 truncate text-xs text-muted-foreground">«{resolving.title}»</p>
            <div className="flex flex-col gap-2">
              {[
                {
                  label: t("cal.pushOneHour"),
                  act: () => {
                    const d = parseLocal(resolving.dueAt);
                    if (d) {
                      d.setHours(d.getHours() + 1);
                      const h = d.getHours(), m = d.getMinutes();
                      updateTask(resolving.id, { dueAt: `${dateKey(d)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` });
                    }
                  },
                },
                {
                  label: t("cal.moveToFree") + (freeSlots[0] ? ` — ${fmtRange(freeSlots[0][0], freeSlots[0][1])}` : ""),
                  act: () => {
                    if (freeSlots[0]) {
                      const s = freeSlots[0][0];
                      updateTask(resolving.id, {
                        dueAt: `${selStr}T${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
                      });
                    }
                  },
                },
                { label: t("cal.keepBoth"), act: () => {} },
              ].map((o, i) => (
                <button
                  key={i}
                  onClick={() => {
                    o.act();
                    setResolving(null);
                    import("sonner").then(({ toast }) => toast(t("cal.resolved")));
                  }}
                  className="rounded-2xl bg-muted px-4 py-3 text-sm font-medium text-left transition-colors hover:bg-accent active:scale-[0.99]"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
