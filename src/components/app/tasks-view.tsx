"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, TaskRow, SectionCard, Chip, EmptyState, Segmented } from "./kit";
import { parseQuickInput } from "@/lib/t0";
import { PRIORITY_STYLE, dateKey, startOfDay } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import type { Priority, Task } from "@/lib/types";
import { motion } from "framer-motion";
import { ListTodo, Plus, Search, Tag, Wand2 } from "lucide-react";

type Filter = "today" | "all" | "done";

export default function TasksView() {
  const { t, lang, level } = useUlos();
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);

  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("today");
  const [pFilter, setPFilter] = useState<Priority | null>(null);
  const [showParsed, setShowParsed] = useState(false);

  const parsed = useMemo(() => parseQuickInput(input, lang), [input, lang]);

  const submit = () => {
    const title = parsed.title.trim();
    if (!title) return;
    addTask({
      title,
      dueAt: parsed.dueAt,
      hasTime: parsed.hasTime,
      priority: parsed.priority ?? "medium",
      tags: parsed.tags,
      repeat: parsed.repeat ?? "none",
      estimateMin: parsed.estimateMin,
      source: "t0",
    });
    setInput("");
    setShowParsed(false);
    import("sonner").then(({ toast }) => toast(t("tasks.created")));
  };

  const today = startOfDay(new Date());
  const todayStr = dateKey(today);
  const recentCutoff = dateKey(new Date(Date.now() - 3 * 86400000));

  const groups = useMemo(() => {
    let pool = tasks;
    if (pFilter) pool = pool.filter((x) => x.priority === pFilter);
    if (filter === "today") {
      return [
        {
          key: "overdue",
          title: t("tasks.groupOverdue"),
          items: pool.filter(
            (x) =>
              x.dueAt &&
              x.dueAt.slice(0, 10) < todayStr &&
              x.dueAt.slice(0, 10) >= recentCutoff &&
              x.status !== "done" &&
              x.status !== "cancelled"
          ),
        },
        {
          key: "today",
          title: t("tasks.groupToday"),
          items: pool.filter(
            (x) =>
              ((x.dueAt && x.dueAt.slice(0, 10) === todayStr) || x.status === "in_progress") &&
              x.status !== "done" &&
              x.status !== "cancelled"
          ),
        },
        {
          key: "nodate",
          title: t("tasks.groupNoDate"),
          items: pool.filter((x) => !x.dueAt && x.status !== "done" && x.status !== "cancelled" && x.status !== "in_progress"),
        },
      ];
    }
    if (filter === "all") {
      return [
        {
          key: "open",
          title: t("common.upcoming"),
          items: pool.filter(
            (x) =>
              x.status !== "done" &&
              x.status !== "cancelled" &&
              (x.status !== "missed" || (x.dueAt && x.dueAt.slice(0, 10) >= recentCutoff))
          ),
        },
      ];
    }
    return [
      {
        key: "done",
        title: t("tasks.groupDone"),
        items: pool.filter((x) => x.status === "done").slice(0, 80),
      },
    ];
  }, [tasks, filter, pFilter, t, todayStr, recentCutoff]);

  const total = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* ─── T0 tezkor kiritish ─── */}
      <SectionCard className="border-violet-500/20">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted px-3 py-2.5">
            <Wand2 className="h-4 w-4 shrink-0 text-violet-500" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onFocus={() => level !== "simple" && setShowParsed(true)}
              placeholder={level === "simple" ? t("tasks.quickPlain") : t("tasks.quickPlaceholder")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <button
            onClick={submit}
            aria-label={t("tasks.addQuick")}
            className="brand-grad flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-90"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {showParsed && level !== "simple" && input.trim() && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            <div className="mt-2.5 rounded-2xl bg-teal-500/[0.06] p-2.5">
              <p className="mb-1.5 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                {t("tasks.parsed")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.matched.length === 0 && (
                  <Chip className="border-border bg-secondary">{t("tasks.groupNoDate")}: «{parsed.title.slice(0, 32)}»</Chip>
                )}
                {parsed.matched.map((m, i) => (
                  <Chip
                    key={i}
                    className={cn(
                      m.type === "date" && "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      m.type === "time" && "border-sky-600/25 bg-sky-600/10 text-sky-700 dark:text-sky-300",
                      m.type === "priority" && "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                      m.type === "tag" && "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
                      m.type === "repeat" && "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
                      m.type === "estimate" && "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {m.type}: {m.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{t("tasks.syntaxHint")}</p>
            </div>
          </motion.div>
        )}
      </SectionCard>

      {/* ─── Filtrlar ─── */}
      <div className="flex flex-col gap-2">
        <Segmented
          items={[
            { value: "today", label: t("common.today") },
            { value: "all", label: t("common.all") },
            { value: "done", label: t("tasks.groupDone") },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-0.5">
          <Chip
            className={cn(
              "cursor-pointer px-3 py-1",
              !pFilter ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"
            )}
            onClick={() => setPFilter(null)}
          >
            {t("common.all")}
          </Chip>
          {(Object.keys(PRIORITY_STYLE) as Priority[]).map((p) => (
            <Chip
              key={p}
              className={cn(
                "cursor-pointer px-3 py-1",
                pFilter === p ? PRIORITY_STYLE[p].chip + " ring-1 " + PRIORITY_STYLE[p].chip.split(" ")[2] : "border-border bg-card text-muted-foreground"
              )}
              onClick={() => setPFilter(pFilter === p ? null : p)}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_STYLE[p].dot)} />
              {t(PRIORITY_STYLE[p].labelKey)}
            </Chip>
          ))}
        </div>
      </div>

      {/* ─── Ro'yxatlar ─── */}
      {total === 0 ? (
        <EmptyState icon={<ListTodo className="h-5 w-5" />} title={filter === "done" ? t("tasks.emptyFiltered") : t("tasks.empty")} hint={t("tasks.syntaxHint")} />
      ) : (
        groups.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.key}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h3 className="text-[13px] font-bold text-muted-foreground">{g.title}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {g.items.length}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-col gap-2">
                  {g.items
                    .sort((a, b) => {
                      if (!a.dueAt && !b.dueAt) return 0;
                      if (!a.dueAt) return 1;
                      if (!b.dueAt) return -1;
                      return a.dueAt > b.dueAt ? 1 : -1;
                    })
                    .map((task) => (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                        <TaskRow task={task} showDateLabel={filter === "all"} />
                      </motion.div>
                    ))}
                </div>
              </div>
            )
        )
      )}
    </div>
  );
}
