"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { makeT, type TFunc } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { clamp, PRIORITY_STYLE, fmtTime, fmtMinutes, isoLocal } from "@/lib/utils-app";
import type { ExperienceLevel, Lang, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlarmClockOff,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  MoreVertical,
  Pencil,
  Repeat2,
  Sparkles,
  Tag,
  Timer,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Kontekst: til, daraja, navigatsiya, drawerlar ──────────────────────────

export type ViewName =
  | "today"
  | "tasks"
  | "calendar"
  | "goals"
  | "more"
  | "notes"
  | "focus"
  | "finance"
  | "audit"
  | "analytics"
  | "settings";

export interface UlosCtxValue {
  t: TFunc;
  lang: Lang;
  level: ExperienceLevel;
  view: ViewName;
  navigate: (v: ViewName) => void;
  openEditor: (task?: Task) => void;
  openMiss: (task: Task) => void;
  openAI: () => void;
  startFocus: (taskId?: string) => void;
  focusTaskId: string | null;
}

const UlosCtx = createContext<UlosCtxValue | null>(null);

export function UlosProvider({ value, children }: { value: UlosCtxValue; children: ReactNode }) {
  return <UlosCtx.Provider value={value}>{children}</UlosCtx.Provider>;
}

export function useUlos(): UlosCtxValue {
  const v = useContext(UlosCtx);
  if (!v) throw new Error("useUlos must be used within UlosProvider");
  return v;
}

/** Persist hydration gate — SSR mosligi uchun (useSyncExternalStore orqali) */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// ─── Atomlar ────────────────────────────────────────────────────────────────

export function Chip({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp: React.ElementType = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap",
        onClick && "transition-transform active:scale-95",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function SectionCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn("rounded-3xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}
    >
      {children}
    </div>
  );
}

export function SectionHead({
  icon,
  title,
  sub,
  right,
  accent = "text-violet-500",
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  right?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 shrink-0 rounded-xl bg-muted p-1.5", accent)}>{icon}</span>
        <div>
          <h2 className="text-[15px] font-bold leading-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  className,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-8 text-center", className)}>
      <span className="rounded-2xl bg-muted p-3 text-muted-foreground">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-2xl bg-muted p-1", className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "flex-1 rounded-xl px-2 py-1.5 text-[13px] font-medium transition-all",
            value === it.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Ring({
  value,
  size = 56,
  stroke = 6,
  colorClass = "stroke-primary",
  trackClass = "stroke-border",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  colorClass?: string;
  trackClass?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamp(value, 0, 1))}
          className={colorClass}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Undo bilan o'chirish — PRD 7-tamoyil: har bir muhim amal bekor qilinadi */
export function deleteWithUndo(
  what: () => void,
  snapshot: () => ReturnType<ReturnType<typeof useStore.getState>["snapshot"]>,
  restore: (s: ReturnType<ReturnType<typeof useStore.getState>["snapshot"]>) => void,
  t: TFunc,
  msgKey: string
) {
  const snap = snapshot();
  what();
  import("sonner").then(({ toast }) => {
    toast(t(msgKey), {
      action: { label: t("common.undo"), onClick: () => { restore(snap); toast(t("undo.restored")); } },
    });
  });
}

// ─── Vazifa qatori (Dashboard va Tasks'da umumiy) ───────────────────────────

export function TaskRow({
  task,
  onOpen,
  compact = false,
  showDateLabel = false,
}: {
  task: Task;
  onOpen?: (t: Task) => void;
  compact?: boolean;
  showDateLabel?: boolean;
}) {
  const { t, lang, openEditor, openMiss } = useUlos();
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);
  const p = PRIORITY_STYLE[task.priority];
  const isDone = task.status === "done";
  const isMissed = task.status === "missed";

  const toggleDone = () => {
    if (isDone) {
      setTaskStatus(task.id, "todo");
    } else {
      setTaskStatus(task.id, "done");
      import("sonner").then(({ toast }) => toast(t("tasks.done")));
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2.5 overflow-hidden rounded-2xl border bg-card transition-colors",
        compact ? "px-3 py-2.5" : "p-3",
        isDone && "opacity-55",
        (task.status === "in_progress") && "border-violet-500/40"
      )}
    >
      <span className={cn("absolute left-0 top-2.5 bottom-2.5 w-[3.5px] rounded-full", p.spine, isDone && "opacity-40")} />
      <button
        onClick={toggleDone}
        aria-label={t("common.done")}
        className={cn(
          "mt-0.5 ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
          isDone
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-400/60 hover:border-emerald-500"
        )}
      >
        {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1" onClick={() => onOpen?.(task)} role={onOpen ? "button" : undefined}>
        <p className={cn("text-sm font-medium leading-snug", isDone && "line-through decoration-2")}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.dueAt && task.hasTime && (
            <Chip className="border-border bg-secondary text-secondary-foreground">
              <Clock className="h-3 w-3" /> {fmtTime(task.dueAt, lang)}
            </Chip>
          )}
          {showDateLabel && task.dueAt && !task.hasTime && (
            <Chip className="border-border bg-secondary text-secondary-foreground">
              <CalendarClock className="h-3 w-3" /> {fmtTime(task.dueAt, lang).slice(0, 5)}
            </Chip>
          )}
          {task.estimateMin ? (
            <Chip className="border-border bg-secondary text-secondary-foreground">
              <Timer className="h-3 w-3" /> {fmtMinutes(task.estimateMin, t)}
            </Chip>
          ) : null}
          {task.repeat !== "none" && (
            <Chip className="border-border bg-secondary text-secondary-foreground">
              <Repeat2 className="h-3 w-3" />
            </Chip>
          )}
          {task.tags.map((tag) => (
            <Chip key={tag} className="border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300">
              <Tag className="h-3 w-3" /> {tag}
            </Chip>
          ))}
          {task.source === "ai" && (
            <Chip className="border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
              <Sparkles className="h-3 w-3" /> {t("tasks.sourceAI")}
            </Chip>
          )}
          {task.source === "t0" && (
            <Chip className="border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300">
              {t("tasks.sourceT0")}
            </Chip>
          )}
          {isMissed && (
            <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300">
              <AlarmClockOff className="h-3 w-3" /> {t(`reason.${task.missReason ?? "other"}`)}
            </Chip>
          )}
          {task.status === "deferred" && (
            <Chip className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
              {t("status.deferred")}
            </Chip>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="menu"
            className="mt-0.5 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl">
          <DropdownMenuItem onClick={() => openEditor(task)}>
            <Pencil className="h-4 w-4" /> {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              d.setHours(9, 0, 0, 0);
              updateTask(task.id, { dueAt: isoLocal(d), status: "todo" });
              import("sonner").then(({ toast }) => toast(t("tasks.rescheduleTomorrow")));
            }}
          >
            <CalendarClock className="h-4 w-4" /> {t("tasks.rescheduleTomorrow")}
          </DropdownMenuItem>
          {!isDone && !isMissed && (
            <DropdownMenuItem onClick={() => openMiss(task)} className="text-rose-600 dark:text-rose-400">
              <AlarmClockOff className="h-4 w-4" /> {t("status.missed")}…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              deleteWithUndo(
                () => deleteTask(task.id),
                snapshot,
                restore,
                t,
                "undo.taskDelete"
              )
            }
            className="text-rose-600 dark:text-rose-400"
          >
            <Trash2 className="h-4 w-4" /> {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {onOpen && (
        <ChevronRight className="pointer-events-none absolute right-1 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/50 group-[&:hover]:block" />
      )}
    </div>
  );
}
