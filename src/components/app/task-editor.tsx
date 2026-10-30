"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos } from "./kit";
import { PRIORITY_STYLE, isoLocal } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import type { MissReason, Priority, Repeat, Task } from "@/lib/types";
import { motion } from "framer-motion";
import { Trash2, X } from "lucide-react";

// ─── Vazifa muharriri — yaratish va tahrirlash ──────────────────────────────

export function TaskEditorDrawer({
  task,
  onClose,
}: {
  task: Task | null; // null = yangi vazifa
  onClose: () => void;
}) {
  const { t } = useUlos();
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [estimate, setEstimate] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("none");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setPriority(task.priority);
      setDate(task.dueAt ? task.dueAt.slice(0, 10) : "");
      setTime(task.dueAt && task.hasTime ? task.dueAt.slice(11, 16) : "");
      setEstimate(task.estimateMin ? String(task.estimateMin) : "");
      setTags(task.tags.join(" "));
      setNotes(task.notes ?? "");
      setRepeat(task.repeat);
    } else {
      setTitle("");
      setPriority("medium");
      setDate("");
      setTime("");
      setEstimate("");
      setTags("");
      setNotes("");
      setRepeat("none");
    }
  }, [task]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const dueAt = date
      ? time
        ? `${date}T${time}`
        : `${date}T09:00`
      : undefined;
    const payload = {
      title: trimmed,
      priority,
      dueAt,
      hasTime: Boolean(time),
      estimateMin: estimate ? Number(estimate) : undefined,
      tags: tags.split(/[\s,]+/).filter(Boolean).map((x) => x.replace(/^#/, "")),
      notes: notes.trim() || undefined,
      repeat,
    };
    if (task) {
      updateTask(task.id, payload);
      import("sonner").then(({ toast }) => toast(t("set.saved")));
    } else {
      addTask(payload);
      import("sonner").then(({ toast }) => toast(t("tasks.created")));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 320 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl border bg-popover p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">
            {task ? t("tasks.editTask") : t("tasks.newTask")}
          </h3>
          <button onClick={onClose} aria-label={t("common.close")} className="rounded-xl bg-muted p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("tasks.titleField")}
          className="mb-3 w-full rounded-2xl bg-muted px-4 py-3.5 text-sm font-medium outline-none focus:ring-1 focus:ring-violet-500/50"
        />

        {/* ustuvorlik */}
        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("tasks.filterPriority")}</p>
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {(Object.keys(PRIORITY_STYLE) as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-semibold transition-all active:scale-95",
                priority === p ? PRIORITY_STYLE[p].chip : "border-border bg-card text-muted-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_STYLE[p].dot)} />
              {t(PRIORITY_STYLE[p].labelKey)}
            </button>
          ))}
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("tasks.dateField")}</p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl bg-muted px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="w-28">
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("tasks.timeField")}</p>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-2xl bg-muted px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="w-20">
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("tasks.estimate")}</p>
            <input
              inputMode="numeric"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="45"
              className="w-full rounded-2xl bg-muted px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("tasks.tags")}</p>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="#ish #o'qish"
              className="w-full rounded-2xl bg-muted px-3.5 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="flex-1">
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("tasks.repeat")}</p>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as Repeat)}
              className="w-full rounded-2xl bg-muted px-3.5 py-2.5 text-sm outline-none"
            >
              {(["none", "daily", "weekdays", "weekly", "every3d"] as Repeat[]).map((r) => (
                <option key={r} value={r}>
                  {t(`tasks.repeat.${r}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t("tasks.notes")}
          className="mb-4 w-full resize-none rounded-2xl bg-muted px-4 py-3 text-sm outline-none"
        />

        <div className="flex gap-2">
          {task && (
            <button
              onClick={() => {
                const snap = snapshot();
                deleteTask(task.id);
                import("sonner").then(({ toast }) =>
                  toast(t("undo.taskDelete"), {
                    action: { label: t("common.undo"), onClick: () => { restore(snap); toast(t("undo.restored")); } },
                  })
                );
                onClose();
              }}
              aria-label={t("common.delete")}
              className="rounded-2xl bg-rose-500/10 px-4 text-rose-500 transition-colors hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
            {t("common.cancel")}
          </button>
          <button onClick={submit} className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white">
            {t("common.save")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── "Bajarilmadi" varaqasi — sabab bilan (PRD 4.1) ─────────────────────────

const REASONS: MissReason[] = ["no_time", "sick", "priority_changed", "not_needed", "other"];

export function MissSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { t } = useUlos();
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const addTask = useStore((s) => s.addTask);
  const [reason, setReason] = useState<MissReason | null>(null);
  const [suggest, setSuggest] = useState(true);

  if (!task) return null;

  const submit = () => {
    if (!reason) return;
    setTaskStatus(task.id, "missed", reason);
    if (suggest) {
      // keyingi kunga taklif: yangi nusxa (ertaga, shu vaqt)
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const sameTime = task.dueAt?.slice(11, 16) ?? "09:00";
      addTask({
        title: task.title,
        priority: task.priority,
        tags: task.tags,
        dueAt: `${d.toISOString().slice(0, 10)}T${sameTime}`,
        hasTime: task.hasTime,
        estimateMin: task.estimateMin,
        source: "user",
        notes: task.notes,
      });
    }
    import("sonner").then(({ toast }) => toast(t("tasks.missed")));
    setReason(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 280 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <h3 className="text-base font-bold">{t("tasks.missTitle")}</h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">«{task.title}»</p>

        <div className="mt-4 flex flex-col gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.99]",
                reason === r
                  ? "border-rose-500/40 bg-rose-500/[0.07] text-rose-600 dark:text-rose-300"
                  : "border-border bg-card"
              )}
            >
              {t(`reason.${r}`)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSuggest(!suggest)}
          className="mt-3 flex w-full items-center gap-2.5 rounded-2xl bg-muted/60 p-3 text-left"
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              suggest ? "border-violet-500 bg-violet-500 text-white" : "border-zinc-400/60"
            )}
          >
            {suggest && <span className="text-[10px] font-bold">✓</span>}
          </span>
          <span className="text-xs font-medium">{t("reason.suggestNext")}</span>
        </button>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
            {t("common.cancel")}
          </button>
          <button
            onClick={submit}
            disabled={!reason}
            className={cn(
              "flex-1 rounded-2xl py-3 text-sm font-semibold transition-all",
              reason ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-muted text-muted-foreground"
            )}
          >
            {t("common.confirm")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
