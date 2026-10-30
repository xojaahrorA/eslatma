"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip, Ring } from "./kit";
import { addDays, dateKey, fmtMinutes, isoLocal, startOfWeek } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import { Pause, Play, RotateCcw, Timer, Coffee } from "lucide-react";
import { motion } from "framer-motion";

export default function FocusView() {
  const { t } = useUlos();
  const tasks = useStore((s) => s.tasks);
  const timeEntries = useStore((s) => s.timeEntries);
  const addTimeEntry = useStore((s) => s.addTimeEntry);
  const updateTask = useStore((s) => s.updateTask);
  const settings = useStore((s) => s.settings);
  const focusTaskId = useRef<string | null>(null);

  const [mode, setMode] = useState<"work" | "break">("work");
  const totalSec = (mode === "work" ? settings.focusWorkMin : settings.focusBreakMin) * 60;
  const [left, setLeft] = useState(totalSec);
  const [running, setRunning] = useState(false);
  const [selTask, setSelTask] = useState<string>("");
  const startRef = useRef<Date | null>(null);

  // startFocus orqali kelgan vazifa
  useEffect(() => {
    const stored = sessionStorage.getItem("ulos-focus-task");
    if (stored) {
      setSelTask(stored);
      sessionStorage.removeItem("ulos-focus-task");
    }
  }, []);

  useEffect(() => {
    setLeft((mode === "work" ? settings.focusWorkMin : settings.focusBreakMin) * 60);
    setRunning(false);
  }, [mode, settings.focusWorkMin, settings.focusBreakMin]);

  const finish = () => {
    const now = new Date();
    if (mode === "work") {
      const task = tasks.find((x) => x.id === selTask);
      addTimeEntry({
        taskId: task?.id,
        label: task?.title ?? t("focus.noTask"),
        start: isoLocal(startRef.current ?? new Date(now.getTime() - settings.focusWorkMin * 60000)),
        end: isoLocal(now),
        mode: "focus",
      });
      if (task) {
        updateTask(task.id, { actualMin: (task.actualMin ?? 0) + settings.focusWorkMin });
      }
      import("sonner").then(({ toast }) =>
        toast.success(t("focus.sessionDone", { min: settings.focusWorkMin }))
      );
      setMode("break");
    } else {
      addTimeEntry({
        label: t("focus.break"),
        start: isoLocal(startRef.current ?? new Date(now.getTime() - settings.focusBreakMin * 60000)),
        end: isoLocal(now),
        mode: "break",
      });
      setMode("work");
    }
    startRef.current = null;
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          setTimeout(finish, 0);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const progress = 1 - left / totalSec;

  const todayStr = dateKey(new Date());
  const todayFocusMin = timeEntries
    .filter((e) => e.mode === "focus" && e.start.slice(0, 10) === todayStr)
    .reduce((a, e) => a + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0);

  const weekBars = useMemo(() => {
    const ws = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i);
      const k = dateKey(d);
      const min = timeEntries
        .filter((e) => e.mode === "focus" && e.start.slice(0, 10) === k)
        .reduce((a, e) => a + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0);
      return { k, min, day: d };
    });
  }, [timeEntries]);
  const maxBar = Math.max(60, ...weekBars.map((b) => b.min));

  const openTasks = tasks.filter((x) => x.status !== "done" && x.status !== "cancelled").slice(0, 10);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      <SectionCard className="relative overflow-hidden">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-[0.07]",
            mode === "work" ? "bg-violet-500" : "bg-teal-500"
          )}
        />
        <div className="relative flex flex-col items-center py-4">
          <Chip
            className={cn(
              "mb-4 px-4 py-1.5",
              mode === "work"
                ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                : "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-300"
            )}
          >
            {mode === "work" ? <Timer className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
            {mode === "work" ? t("focus.work") : t("focus.break")}
          </Chip>

          <motion.div
            key={mode}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Ring value={progress} size={210} stroke={12} colorClass={mode === "work" ? "stroke-violet-500" : "stroke-teal-500"}>
              <div className="text-center">
                <span className="block text-5xl font-bold tabular-nums tracking-tight">
                  {mm}:{ss}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {t("focus.pomodoro", { w: settings.focusWorkMin, b: settings.focusBreakMin })}
                </span>
              </div>
            </Ring>
          </motion.div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => {
                if (!running) startRef.current = new Date();
                setRunning(!running);
              }}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl transition-transform active:scale-90",
                mode === "work" ? "brand-grad shadow-violet-500/30" : "bg-teal-500 shadow-teal-500/30"
              )}
              aria-label={running ? t("focus.pause") : t("focus.start")}
            >
              {running ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setLeft(totalSec);
                startRef.current = null;
              }}
              aria-label={t("focus.reset")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>

          {/* vazifa tanlash */}
          <div className="mt-5 w-full">
            <label className="mb-1.5 block text-center text-[11px] font-medium text-muted-foreground">
              {t("focus.selectTask")}
            </label>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelTask("")}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                  !selTask ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground"
                )}
              >
                {t("focus.noTask")}
              </button>
              {openTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelTask(task.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
                    selTask === task.id
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {task.title.length > 26 ? task.title.slice(0, 26) + "…" : task.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* bugungi jami */}
      <div className="grid grid-cols-2 gap-3">
        <SectionCard className="text-center">
          <p className="text-2xl font-bold brand-text">{fmtMinutes(todayFocusMin, t)}</p>
          <p className="text-[11px] text-muted-foreground">{t("focus.todayTotal")}</p>
        </SectionCard>
        <SectionCard className="text-center">
          <p className="text-2xl font-bold">{timeEntries.filter((e) => e.mode === "focus" && e.start.slice(0, 10) === todayStr).length}</p>
          <p className="text-[11px] text-muted-foreground">{t("focus.work")} ×</p>
        </SectionCard>
      </div>

      {/* haftalik diagramma */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-bold">{t("focus.weekChart")}</h3>
        <div className="flex h-28 items-end gap-1.5">
          {weekBars.map((b, i) => (
            <div key={b.k} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (b.min / maxBar) * 84)}px` }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 120 }}
                className={cn(
                  "w-full rounded-lg",
                  b.k === todayStr ? "brand-grad" : "bg-muted-foreground/25"
                )}
              />
              <span className={cn("text-[9px]", b.k === todayStr ? "font-bold text-violet-500" : "text-muted-foreground")}>
                {new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(b.day)}
              </span>
            </div>
          ))}
        </div>
        {todayFocusMin === 0 && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("focus.emptyWeek")}</p>
        )}
      </SectionCard>
    </div>
  );
}
