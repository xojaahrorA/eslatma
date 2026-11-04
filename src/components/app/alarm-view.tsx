"use client";

/**
 * ─── Budilnik — ro'yxat, muharrir, takrorlanish kunlari ─────────────────────
 * Rejalash syncAlarms() orqali page.tsx'da amalga oshiriladi (bu yerda
 * faqat ma'lumot + UI). O'chirish "Undo" bilan.
 */

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, Chip, EmptyState, SectionCard } from "./kit";
import { nextOccurrence } from "@/lib/alarm";
import { relDay } from "@/lib/utils-app";
import type { Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlarmClock, BellRing, Pencil, Plus, Target, Trash2, X } from "lucide-react";

/** 7 kun — JS getDay tartibida (0=Yak..6=Sha), ko'rsatish dushanbadan */
const DOW = [1, 2, 3, 4, 5, 6, 0];
const DOW_SHORT: Record<number, string> = { 0: "Yak", 1: "Dush", 2: "Sesh", 3: "Chor", 4: "Pay", 5: "Jum", 6: "Sha" };

export default function AlarmView() {
  const { t } = useUlos();
  const alarms = useStore((s) => s.alarms);
  const addAlarm = useStore((s) => s.addAlarm);
  const updateAlarm = useStore((s) => s.updateAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [open, setOpen] = useState(false);

  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (a: Alarm) => {
    setEditing(a);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
      <button onClick={openNew} className="brand-grad flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-transform active:scale-[0.99]">
        <Plus className="h-4.5 w-4.5" strokeWidth={2.5} />
        {t("alarm.add")}
      </button>

      {sorted.length === 0 && (
        <EmptyState icon={<AlarmClock className="h-6 w-6" />} title={t("alarm.empty")} hint={t("alarm.emptyHint")} className="py-10" />
      )}

      {sorted.map((a) => {
        const next = a.enabled ? nextOccurrence(a.time, a.days) : null;
        const once = a.days.length === 0;
        return (
          <SectionCard key={a.id} className={cn("flex items-center gap-3 py-3.5 transition-opacity", !a.enabled && "opacity-55")}>
            {/* switch */}
            <button
              onClick={() => updateAlarm(a.id, { enabled: !a.enabled })}
              aria-label={a.enabled ? "off" : "on"}
              className={cn(
                "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors",
                a.enabled ? "bg-violet-500" : "bg-muted-foreground/25"
              )}
            >
              <span className={cn("h-6 w-6 rounded-full bg-white shadow transition-transform", a.enabled && "translate-x-5")} />
            </button>

            <div className="min-w-0 flex-1" onClick={() => openEdit(a)} role="button">
              <p className="text-[22px] font-extrabold leading-none tabular-nums">{a.time}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {a.label && <span className="text-xs font-medium text-muted-foreground">{a.label}</span>}
                {once ? (
                  <Chip className="border-border bg-secondary text-secondary-foreground">{t("alarm.once")}</Chip>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {DOW.filter((d) => a.days.includes(d)).map((d) => DOW_SHORT[d]).join(" · ")}
                  </span>
                )}
                {a.challenge && (
                  <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300">
                    <Target className="h-3 w-3" /> ✓
                  </Chip>
                )}
              </div>
              {next && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-violet-500">
                  <BellRing className="h-3 w-3" />
                  {t("alarm.next")}: {relDay(next, t)} {a.time}
                </p>
              )}
            </div>

            <button onClick={() => openEdit(a)} aria-label={t("common.edit")} className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </button>
          </SectionCard>
        );
      })}

      {open && (
        <AlarmEditor
          alarm={editing}
          t={t}
          onClose={() => setOpen(false)}
          onSave={(data) => {
            if (editing) {
              updateAlarm(editing.id, data);
            } else {
              addAlarm(data);
            }
            import("sonner").then(({ toast }) => toast(t("alarm.saved")));
            setOpen(false);
          }}
          onDelete={editing ? () => {
            const snap = useStore.getState().alarms;
            deleteAlarm(editing.id);
            import("sonner").then(({ toast }) =>
              toast(t("alarm.deleted"), {
                action: { label: t("common.undo"), onClick: () => useStore.setState({ alarms: snap }) },
              })
            );
            setOpen(false);
          } : undefined}
        />
      )}
    </div>
  );
}

// ─── Muharrir (bottom sheet) ────────────────────────────────────────────────

function AlarmEditor({
  alarm,
  t,
  onClose,
  onSave,
  onDelete,
}: {
  alarm: Alarm | null;
  t: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
  onSave: (a: Pick<Alarm, "time" | "days" | "label" | "challenge" | "enabled">) => void;
  onDelete?: () => void;
}) {
  const [time, setTime] = useState("07:00");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [challenge, setChallenge] = useState(true);

  useEffect(() => {
    if (alarm) {
      setTime(alarm.time);
      setLabel(alarm.label ?? "");
      setDays(alarm.days);
      setChallenge(alarm.challenge);
    } else {
      setTime("07:00");
      setLabel("");
      setDays([1, 2, 3, 4, 5]);
      setChallenge(true);
    }
  }, [alarm]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

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
          <h3 className="text-base font-bold">{t("alarm.add")}</h3>
          <button onClick={onClose} aria-label={t("common.close")} className="rounded-xl bg-muted p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Vaqt — katta */}
        <div className="mb-4 flex items-center justify-center">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-3xl bg-muted px-8 py-4 text-center text-[44px] font-extrabold tabular-nums outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>

        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("alarm.label")}</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("alarm.labelPh")}
          className="mb-4 w-full rounded-2xl bg-muted px-4 py-3 text-sm outline-none"
        />

        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("alarm.days")}</p>
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DOW.map((d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={cn(
                "rounded-xl border py-2 text-[10px] font-bold transition-all active:scale-95",
                days.includes(d)
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {DOW_SHORT[d]}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[11px] text-muted-foreground">
          {days.length === 0 ? t("alarm.once") : `${days.length} ${t("alarm.days").toLowerCase()}`}
        </p>

        <button
          onClick={() => setChallenge(!challenge)}
          className={cn(
            "mb-4 flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
            challenge ? "border-rose-500/35 bg-rose-500/[0.07]" : "border-border bg-card"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              challenge ? "border-rose-500 bg-rose-500 text-white" : "border-zinc-400/60"
            )}
          >
            {challenge && <span className="text-[10px] font-bold">✓</span>}
          </span>
          <span>
            <span className="block text-sm font-bold">{t("alarm.challenge")}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{t("alarm.challengeSub")}</span>
          </span>
        </button>

        <div className="flex gap-2">
          {onDelete && (
            <button onClick={onDelete} aria-label={t("common.delete")} className="rounded-2xl bg-rose-500/10 px-4 text-rose-500 transition-colors hover:bg-rose-500/20">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onSave({ time, days, label: label.trim() || undefined, challenge, enabled: true })}
            className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
          >
            {t("common.save")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
