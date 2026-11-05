"use client";

/**
 * ─── Budilnik — ro'yxat, muharrir, missiyalar, aqili rejim (v1.8) ────────────
 * Rejalash syncAlarms() orqali page.tsx'da amalga oshiriladi (bu yerda
 * faqat ma'lumot + UI). O'chirish "Undo" bilan.
 *
 * Aqili rejim (o'zi qo'shib qo'yadi):
 *  • missiya tartibi har zangda avtomatik aralashadi (mushak xotirasiga qarshi)
 *  • qiyinlik avtomatik moslashadi (snooze qilinsa — keyingi safar qiyinroq)
 *  • yotish eslatmasi budilnik vaqtidan uyqu maqsadiga qarab avtomatik qo'yiladi
 *  • uyg'onish statistikasi (streak) avtomatik yig'iladi
 */

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, Chip, EmptyState, SectionCard, Segmented } from "./kit";
import { MISSION_META } from "./missions";
import { nextOccurrence } from "@/lib/alarm";
import { pad2, relDay } from "@/lib/utils-app";
import { sessionKind } from "@/lib/sleep-insights";
import type { Alarm, MissionDifficulty, MissionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlarmClock, BellRing, Flame, Pencil, Plus, Sparkles, Target, TimerOff, Trash2, X } from "lucide-react";

/** 7 kun — JS getDay tartibida (0=Yak..6=Sha), ko'rsatish dushanbadan */
const DOW = [1, 2, 3, 4, 5, 6, 0];
const DOW_SHORT: Record<number, string> = { 0: "Yak", 1: "Dush", 2: "Sesh", 3: "Chor", 4: "Pay", 5: "Jum", 6: "Sha" };

const MTYPES: MissionType[] = ["math", "memory", "typing", "shake", "motion"];

export interface AlarmSave {
  time: string;
  days: number[];
  label?: string;
  challenge: boolean;
  enabled: boolean;
  missions: MissionType[];
  difficulty: MissionDifficulty;
  smart: boolean;
  snoozeLimit: number | null;
  snoozeMin: number;
  gentle: boolean;
}

export default function AlarmView() {
  const { t } = useUlos();
  const alarms = useStore((s) => s.alarms);
  const alarmStats = useStore((s) => s.alarmStats);
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

  const handleSave = (data: AlarmSave) => {
    if (editing) {
      updateAlarm(editing.id, data);
    } else {
      addAlarm(data);
    }
    // ─── Aqili rejim: yotish eslatmasi o'zi qo'yiladi (v1.9 — o'lchangan
    // uxlash vaqti ham hisobga olinadi) ───
    const st = useStore.getState();
    if (data.smart && data.enabled) {
      const [h, m] = data.time.split(":").map(Number);
      const goalH = st.settings.sleepGoalH ?? 8;
      // so'nggi 7 tunning o'rtacha uxlash vaqti (sensor/qo'lda)
      const nights = st.sleepSessions.filter((s) => sessionKind(s) === "night").slice(-7);
      const avgLat = nights.length
        ? Math.round(
            nights.reduce((a, s) => a + Math.max(0, Math.min(s.latencyMin ?? 12, 60)), 0) / nights.length
          )
        : 12;
      const total = h * 60 + m - goalH * 60 - avgLat;
      const btH = ((Math.floor(total / 60) % 24) + 24) % 24;
      const btM = ((total % 60) + 60) % 60;
      const bt = `${pad2(btH)}:${pad2(btM)}`;
      const cur = st.settings.sleepBedtime;
      // v1.10: foydalanuvchi yotish vaqtini o'zi qo'ysa (yoki o'chirsa) —
      // aqili rejim ustidan yozmaydi, majburiy vaqt yo'q
      if (st.settings.sleepBedtimeManual) {
        import("sonner").then(({ toast }) =>
          toast(t("alarm.bedtimeManual", { t: cur ?? bt }))
        );
      } else if (!cur) {
        st.setSettings({ sleepBedtime: bt });
        import("sonner").then(({ toast }) => toast(t("alarm.bedtimeAuto", { t: bt })));
      } else {
        // mavjud eslatma o'lchangan rejamdan 45+ daqiqa chetda — yangilaymiz
        const toMin = (x: string) => {
          const [hh, mm] = x.split(":").map(Number);
          let v = hh * 60 + mm;
          if (v < 12 * 60) v += 24 * 60;
          return v;
        };
        if (Math.abs(toMin(bt) - toMin(cur)) >= 45) {
          st.setSettings({ sleepBedtime: bt });
          import("sonner").then(({ toast }) => toast(t("alarm.bedtimeUpdated", { o: cur, t: bt })));
        } else {
          import("sonner").then(({ toast }) => toast(t("alarm.saved")));
        }
      }
    } else {
      import("sonner").then(({ toast }) => toast(t("alarm.saved")));
    }
    setOpen(false);
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
        const missions = a.missions && a.missions.length ? a.missions : a.challenge ? (["math"] as MissionType[]) : [];
        const stat = a.id ? alarmStats[a.id] : undefined;
        const firstMeta = missions.length ? MISSION_META[missions[0]] : null;
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
                {a.smart && (
                  <Chip className="border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <Sparkles className="h-3 w-3" /> {t("alarm.smart")}
                  </Chip>
                )}
                {missions.length > 0 && firstMeta && (() => {
                  const FirstIcon = firstMeta.icon;
                  return (
                    <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300">
                      <Target className="h-3 w-3" />
                      <FirstIcon className="h-3 w-3" />
                      {missions.length > 1 ? `×${missions.length}` : ""}
                    </Chip>
                  );
                })()}
                {!a.smart && a.challenge && a.difficulty === "hard" && (
                  <Chip className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">{t("diff.hard")}</Chip>
                )}
                {a.snoozeLimit === 0 && (
                  <TimerOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {stat && stat.streak > 0 && (
                  <Chip className="border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300">
                    <Flame className="h-3 w-3" /> {stat.streak}
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
          onSave={handleSave}
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
  onSave: (a: AlarmSave) => void;
  onDelete?: () => void;
}) {
  const [time, setTime] = useState("07:00");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [challenge, setChallenge] = useState(true);
  const [smart, setSmart] = useState(true);
  const [missions, setMissions] = useState<MissionType[]>(["math"]);
  const [difficulty, setDifficulty] = useState<MissionDifficulty>("medium");
  const [snoozeMin, setSnoozeMin] = useState(5);
  const [snoozeLimit, setSnoozeLimit] = useState<number | null>(1);
  const [gentle, setGentle] = useState(false);

  useEffect(() => {
    if (alarm) {
      setTime(alarm.time);
      setLabel(alarm.label ?? "");
      setDays(alarm.days);
      setChallenge(alarm.challenge);
      setSmart(alarm.smart ?? false);
      setMissions(alarm.missions && alarm.missions.length ? alarm.missions : alarm.challenge ? ["math"] : []);
      setDifficulty(alarm.difficulty ?? "medium");
      setSnoozeMin(alarm.snoozeMin ?? 5);
      setSnoozeLimit(alarm.snoozeLimit === undefined ? null : alarm.snoozeLimit);
      setGentle(alarm.gentle ?? false);
    } else {
      setTime("07:00");
      setLabel("");
      setDays([1, 2, 3, 4, 5]);
      setChallenge(true);
      setSmart(true);
      setMissions(["math"]);
      setDifficulty("medium");
      setSnoozeMin(5);
      setSnoozeLimit(1);
      setGentle(false);
    }
  }, [alarm]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const toggleMission = (m: MissionType) =>
    setMissions((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m);
      if (prev.length >= 4) return prev;
      return [...prev, m];
    });

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
          <h3 className="text-base font-bold">{alarm ? t("common.edit") : t("alarm.add")}</h3>
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

        {/* ─── Aqili rejim ─── */}
        <button
          onClick={() => setSmart(!smart)}
          className={cn(
            "mb-3 flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
            smart ? "border-violet-500/35 bg-violet-500/[0.07]" : "border-border bg-card"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              smart ? "border-violet-500 bg-violet-500 text-white" : "border-zinc-400/60"
            )}
          >
            {smart && <span className="text-[10px] font-bold">✓</span>}
          </span>
          <span>
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              {t("alarm.smart")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{t("alarm.smartSub")}</span>
          </span>
        </button>

        {/* ─── Topshiriqli o'chirish ─── */}
        <button
          onClick={() => setChallenge(!challenge)}
          className={cn(
            "mb-3 flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
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

        {/* ─── Missiyalar (zanjir) ─── */}
        {challenge && (
          <div className="mb-3 rounded-2xl border border-border bg-card p-3.5">
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{t("alarm.missions")}</p>
            <p className="mb-2.5 text-[10px] leading-snug text-muted-foreground/80">{t("alarm.missionsHint")}</p>
            <div className="flex flex-wrap gap-1.5">
              {MTYPES.map((m, i) => {
                const meta = MISSION_META[m];
                const MIcon = meta.icon;
                const sel = missions.includes(m);
                const order = missions.indexOf(m) + 1;
                return (
                  <button
                    key={m}
                    onClick={() => toggleMission(m)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                      sel
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                  >
                    {sel && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                        {order}
                      </span>
                    )}
                    <MIcon className="h-3.5 w-3.5" />
                    {t(meta.key)}
                  </button>
                );
              })}
            </div>
            {missions.length === 0 && (
              <p className="mt-2 text-[10px] font-semibold text-amber-500">{t("alarm.missionsEmpty")}</p>
            )}

            {/* Qiyinlik — aqili rejimda avtomatik, shuning uchun faqat o'chirilganda ko'rinadi */}
            {!smart && (
              <>
                <p className="mb-1.5 mt-3 text-[11px] font-semibold text-muted-foreground">{t("alarm.difficulty")}</p>
                <Segmented
                  items={[
                    { value: "easy", label: t("diff.easy") },
                    { value: "medium", label: t("diff.medium") },
                    { value: "hard", label: t("diff.hard") },
                  ]}
                  value={difficulty}
                  onChange={setDifficulty}
                />
              </>
            )}
          </div>
        )}

        {/* ─── Snooze sozlamalari ─── */}
        <div className="mb-3 rounded-2xl border border-border bg-card p-3.5">
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">{t("alarm.snoozeSet")}</p>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{t("alarm.snoozeDur")}</span>
            <Segmented
              items={[
                { value: "5", label: "5" },
                { value: "10", label: "10" },
                { value: "15", label: "15" },
              ]}
              value={String(snoozeMin)}
              onChange={(v) => setSnoozeMin(Number(v))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{t("alarm.snoozeLimit")}</span>
            <div className="flex flex-1 gap-1">
              {[
                { v: null as number | null, label: t("snooze.unlimited") },
                { v: 0 as number | null, label: "0" },
                { v: 1 as number | null, label: "1" },
                { v: 2 as number | null, label: "2" },
                { v: 3 as number | null, label: "3" },
              ].map((it) => (
                <button
                  key={String(it.v)}
                  onClick={() => setSnoozeLimit(it.v)}
                  className={cn(
                    "flex-1 rounded-xl border py-1.5 text-[11px] font-bold transition-all active:scale-95",
                    snoozeLimit === it.v
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                      : "border-border bg-secondary text-muted-foreground"
                  )}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Yengil uyg'otish ─── */}
        <button
          onClick={() => setGentle(!gentle)}
          className={cn(
            "mb-5 flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
            gentle ? "border-teal-500/35 bg-teal-500/[0.07]" : "border-border bg-card"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              gentle ? "border-teal-500 bg-teal-500 text-white" : "border-zinc-400/60"
            )}
          >
            {gentle && <span className="text-[10px] font-bold">✓</span>}
          </span>
          <span>
            <span className="block text-sm font-bold">{t("alarm.gentle")}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{t("alarm.gentleSub")}</span>
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
            onClick={() =>
              onSave({
                time,
                days,
                label: label.trim() || undefined,
                challenge,
                enabled: true,
                missions: challenge && missions.length === 0 ? ["math"] : missions,
                difficulty,
                smart,
                snoozeLimit,
                snoozeMin,
                gentle,
              })
            }
            className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
          >
            {t("common.save")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
