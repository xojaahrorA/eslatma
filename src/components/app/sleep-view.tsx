"use client";

/**
 * ─── Uyqu kuzatuvi — to'liq tahlil (PRD 4.7) ────────────────────────────────
 * • Sessiya: "Uxlashni boshlash" → "Uyg'ondim" — davomiylik avtomatik.
 * • Sensor rejimi (APK): native akselerometr servisi har daqiqalik harakatni
 *   yozadi → bosqichlar (chuqur/yengil/REM) harakatdan aniqlanadi.
 * • Qo'lda rejim: 3 tezkor savol → tibbiy o'rtachalar asosida taxmin.
 * • Statistika: 7 kunlik grafik, o'rtacha, uyqu qarzi, muntazamlik.
 * Barcha hisoblar qurilmada — hech qayerga jo'natilmaydi.
 */

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, Chip, EmptyState, SectionCard, SectionHead } from "./kit";
import { analyzeSleep, consistencyScore, sleepDebt, weeklySeries } from "@/lib/sleep";
import {
  bedtimePattern,
  daySegments,
  sessionKind,
  sleepAdvice,
  sleepTaskLink,
  type AdviceAction,
} from "@/lib/sleep-insights";
import { inApkEnv } from "@/lib/notify";
import { sensorAvailable, sensorStart, sensorStop } from "@/lib/sleep-sensor";
import { fmtMinutes, fmtShortDate, isoLocal, pad2, parseLocal, uuidv7 } from "@/lib/utils-app";
import type { SleepSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BatteryCharging,
  BedDouble,
  Coffee,
  Footprints,
  Gauge,
  Layers,
  Lightbulb,
  Moon,
  MoonStar,
  Play,
  Plus,
  Square,
  Sunrise,
  Timer,
  Trash2,
  Waves,
  X,
} from "lucide-react";

const GOALS = [6, 7, 8, 9];
/** Tezkor yotish vaqtlari — chip bilan bir bosishda o'zgartirish (v1.10) */
const BEDTIMES = ["22:00", "22:30", "23:00", "23:30", "00:00"];
/** Wind-down eslatma daqiqalari — foydalanuvchi tanlaydi (majburiy 30 emas) */
const WINDS = [15, 30, 45, 60];

export default function SleepView() {
  const { t, lang } = useUlos();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const sessions = useStore((s) => s.sleepSessions);
  const active = useStore((s) => s.sleepActive);
  const setSleepActive = useStore((s) => s.setSleepActive);
  const addSleepSession = useStore((s) => s.addSleepSession);
  const deleteSleepSession = useStore((s) => s.deleteSleepSession);

  const [apk, setApk] = useState(false);
  const [sensorOk, setSensorOk] = useState(false);
  const [sensorOn, setSensorOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [stopOpen, setStopOpen] = useState(false);
  const [dropAsk, setDropAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  // stop dialog holati
  const [quality, setQuality] = useState(3);
  const [lat, setLat] = useState(15);
  const [wakings, setWakings] = useState(0);
  // dam olish (tushlik uyqusi) taymeri — null = oddiy sessiya
  const [napTarget, setNapTarget] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  // ─── Qo'lda qo'shish: esdan chiqqan yotishni keyin yozish (v1.10) ───
  const [manOpen, setManOpen] = useState(false);
  const today0 = new Date();
  const [mDate, setMDate] = useState(
    () => `${today0.getFullYear()}-${pad2(today0.getMonth() + 1)}-${pad2(today0.getDate())}`
  );
  const [mBed, setMBed] = useState("23:30");
  const [mUp, setMUp] = useState("07:00");
  const [mErr, setMErr] = useState<string | null>(null);

  const goalH = settings.sleepGoalH ?? 8;
  const goalMin = goalH * 60;
  const bedtime = settings.sleepBedtime ?? null;

  useEffect(() => {
    if (inApkEnv()) {
      setApk(true);
      sensorAvailable().then(setSensorOk);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const iv = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(iv);
  }, [active]);

  const last = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => (parseLocal(b.end)?.getTime() ?? 0) - (parseLocal(a.end)?.getTime() ?? 0));
    return sorted[0] ?? null;
  }, [sessions]);
  const lastAnalysis = useMemo(() => (last ? analyzeSleep(last, goalH) : null), [last, goalH]);
  const series = useMemo(() => weeklySeries(sessions, 7), [sessions]);
  const debt = useMemo(() => sleepDebt(series, goalMin), [series, goalMin]);
  const consistency = useMemo(() => consistencyScore(sessions), [sessions]);
  const avg7 = useMemo(() => {
    const days = series.filter((d) => d.sleepMin > 0);
    if (!days.length) return null;
    return Math.round(days.reduce((a, d) => a + d.sleepMin, 0) / days.length);
  }, [series]);
  const maxScale = Math.max(goalMin * 1.25, ...series.map((d) => d.sleepMin), 60);

  // ─── Bugungi norma: bo'lib-bo'lib yig'ilgan jami (v1.10) ───
  const todayRow = useMemo(() => daySegments(sessions, 1)[0] ?? null, [sessions]);
  const todayPct = todayRow && todayRow.totalMin > 0 ? Math.min(199, Math.round((todayRow.totalMin / goalMin) * 100)) : 0;
  const leftMin = todayRow ? Math.max(0, goalMin - todayRow.totalMin) : goalMin;
  const overMin = todayRow ? Math.max(0, todayRow.totalMin - goalMin) : 0;

  const startSleep = async (napMin?: number) => {
    const id = uuidv7();
    let sensor = false;
    if (apk && sensorOk && sensorOn) {
      setBusy(true);
      const r = await sensorStart(id);
      setBusy(false);
      sensor = r.ok;
      if (!r.ok) {
        import("sonner").then(({ toast }) => toast.error(t("sleep.sensorWeb")));
      }
    }
    setNapTarget(napMin ?? null);
    setSleepActive({ id, start: isoLocal(new Date()), sensor });
  };

  // Sessiyani saqlash yadrosi — dialog ham, avto-to'xtatish ham shu orqali
  const saveSession = async (opts: { quality: number; lat: number; wakings: number }) => {
    if (!active) return null;
    let motion: number[] | undefined;
    if (active.sensor) {
      const r = await sensorStop();
      if (r.ok && r.data) {
        try {
          const j = JSON.parse(r.data) as { minutes?: { mv: number }[] };
          motion = (j.minutes ?? []).map((m) => m.mv);
        } catch {
          /* ignore */
        }
      }
    }
    const sess: SleepSession = {
      id: active.id,
      start: active.start,
      end: isoLocal(new Date()),
      latencyMin: opts.lat,
      wakings: opts.wakings,
      quality: opts.quality,
      motion,
      sensor: active.sensor,
    };
    const a = analyzeSleep(sess, goalH);
    if (a) {
      sess.stages = a.stages;
      sess.score = a.score;
    }
    addSleepSession(sess);
    return sess;
  };

  const confirmStop = async () => {
    setBusy(true);
    const sess = await saveSession({ quality, lat, wakings });
    setBusy(false);
    setStopOpen(false);
    if (sess) {
      import("sonner").then(({ toast }) =>
        toast.success(
          t("sleep.saved") + (sess.score != null ? ` · ${t("sleep.score")}: ${sess.score}` : "")
        )
      );
    }
  };

  // Dam olish taymeri tugadi — o'zi to'xtatadi va saqlaydi (aqilli rejim)
  const autoNapStop = async () => {
    if (!active) return;
    const mins = napTarget ?? 0;
    setNapTarget(null);
    const sess = await saveSession({ quality: 3, lat: 0, wakings: 0 });
    if (sess) {
      import("sonner").then(({ toast }) =>
        toast.success(t("sleep.napSaved", { m: mins }), {
          description: sess.score != null ? `${t("sleep.score")}: ${sess.score}` : undefined,
        })
      );
    }
  };

  const discard = () => {
    if (active?.sensor) void sensorStop();
    setSleepActive(null);
    setNapTarget(null);
    setDropAsk(false);
    setStopOpen(false);
    import("sonner").then(({ toast }) => toast(t("sleep.discarded")));
  };

  // ─── Qo'lda qo'shish: yotish–uyg'onish vaqtini keyin yozish ───
  const saveManual = () => {
    const [bh, bm] = mBed.split(":").map(Number);
    const [uh, um] = mUp.split(":").map(Number);
    const bed = parseLocal(`${mDate}T00:00`);
    if (!bed || Number.isNaN(bh) || Number.isNaN(uh)) {
      setMErr(t("sleep.mErr"));
      return;
    }
    const b = new Date(bed);
    b.setHours(Math.min(23, bh), Math.min(59, bm || 0), 0, 0);
    const u = new Date(bed);
    u.setHours(Math.min(23, uh), Math.min(59, um || 0), 0, 0);
    if (u.getTime() <= b.getTime()) u.setDate(u.getDate() + 1); // kechadan o'tgan
    const dur = Math.round((u.getTime() - b.getTime()) / 60_000);
    if (dur < 1) {
      setMErr(t("sleep.mErr"));
      return;
    }
    if (dur > 16 * 60) {
      setMErr(t("sleep.mErrLong"));
      return;
    }
    const sess: SleepSession = {
      id: uuidv7(),
      start: isoLocal(b),
      end: isoLocal(u),
      latencyMin: 12,
      wakings: 0,
      manual: true,
    };
    const a = analyzeSleep(sess, goalH);
    if (a) {
      sess.stages = a.stages;
      sess.score = a.score;
    }
    addSleepSession(sess);
    setManOpen(false);
    setMErr(null);
    import("sonner").then(({ toast }) =>
      toast.success(t("sleep.mSaved") + (sess.score != null ? ` · ${t("sleep.score")}: ${sess.score}` : ""))
    );
  };

  const elapsedMin = active ? Math.max(0, Math.round((now - (parseLocal(active.start)?.getTime() ?? now)) / 60000)) : 0;

  // ─── Aqili tahlil (v1.9) ───
  const segRows = useMemo(() => daySegments(sessions, 7), [sessions]);
  const pat = useMemo(() => bedtimePattern(sessions), [sessions]);
  const alarms = useStore((s) => s.alarms);
  const alarmStats = useStore((s) => s.alarmStats);
  const tasks = useStore((s) => s.tasks);
  const advices = useMemo(
    () => sleepAdvice(sessions, alarms, alarmStats, settings),
    [sessions, alarms, alarmStats, settings]
  );
  const link = useMemo(
    () => sleepTaskLink(sessions, tasks, goalMin),
    [sessions, tasks, goalMin]
  );

  // dam olish taymeri — vaqti kelganda o'zi to'xtatadi
  useEffect(() => {
    if (!active || napTarget == null) return;
    if (elapsedMin >= napTarget) void autoNapStop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, active, napTarget]);

  const applyAdvice = (key: string, act: AdviceAction) => {
    const st = useStore.getState();
    if (act.kind === "setBedtime") st.setSettings({ sleepBedtime: act.value, sleepBedtimePrev: act.value, sleepBedtimeManual: true });
    else if (act.kind === "setWindMin") st.setSettings({ sleepWindMin: act.value });
    else if (act.kind === "setGoal") st.setSettings({ sleepGoalH: act.value });
    else if (act.kind === "shiftAlarm") st.updateAlarm(act.alarmId, { time: act.value });
    setApplied((prev) => new Set(prev).add(key));
    import("sonner").then(({ toast }) => toast.success(t("sad.applied")));
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
      {/* ─── Holat kartasi ─── */}
      {active ? (
        <SectionCard className="relative overflow-hidden border-violet-500/30 bg-violet-500/[0.05]">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-violet-500/15 blur-2xl"
          />
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-violet-500/15 p-3 text-violet-500">
              <MoonStar className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t("sleep.active")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("sleep.startedAt", { t: active.start.slice(11, 16) })} · {t("sleep.elapsed")}{" "}
                <span className="font-semibold tabular-nums text-foreground">{fmtMinutes(elapsedMin, t)}</span>
              </p>
              {napTarget != null && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-500">
                  <Coffee className="h-3.5 w-3.5" />
                  {t("sleep.napLeft", { m: Math.max(0, napTarget - elapsedMin) })}
                </p>
              )}
            </div>
            {active.sensor && (
              <Chip className="border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300">
                <Waves className="h-3 w-3" />
              </Chip>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setDropAsk(true)}
              className="rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => {
                setQuality(3);
                setLat(15);
                setWakings(0);
                setStopOpen(true);
              }}
              className="brand-grad flex-1 rounded-2xl py-3 text-sm font-bold text-white transition-transform active:scale-[0.99]"
            >
              {t("sleep.stop")}
            </button>
          </div>
          <p className="mt-3 text-[10.5px] leading-snug text-muted-foreground/70">{t("sleep.trackingNote")}</p>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-2">
            <span className="brand-grad flex h-16 w-16 items-center justify-center rounded-[24px] text-white shadow-lg shadow-violet-500/25">
              <Moon className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <button
              onClick={() => startSleep()}
              disabled={busy}
              className="brand-grad flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {t("sleep.start")}
            </button>
          </div>

          {/* Dam olish (tushlik uyqusi) — taymer bilan: o'zi to'xtatadi */}
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Coffee className="h-3.5 w-3.5" />
              {t("sleep.napTitle")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[20, 30, 45].map((n) => (
                <button
                  key={n}
                  onClick={() => startSleep(n)}
                  disabled={busy}
                  className="rounded-xl border py-2.5 text-xs font-bold transition-all active:scale-95 hover:border-amber-500/40 hover:text-amber-500"
                >
                  {t("sleep.napBtn", { n })}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground/70">{t("sleep.napHint")}</p>
          </div>

          {/* Sensor rejimi */}
          {apk && sensorOk ? (
            <>
              <button
                onClick={() => setSensorOn(!sensorOn)}
                className={cn(
                  "mt-3 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                  sensorOn ? "border-teal-500/35 bg-teal-500/[0.06]" : "border-border bg-card"
                )}
              >
                <span className={cn("rounded-xl p-2", sensorOn ? "bg-teal-500/15 text-teal-500" : "bg-muted text-muted-foreground")}>
                  <Footprints className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{t("sleep.sensor")}</span>
                    <span className={cn("flex h-5.5 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors", sensorOn ? "bg-teal-500" : "bg-muted-foreground/25")}>
                      <span className={cn("h-4.5 w-4.5 rounded-full bg-white shadow transition-transform", sensorOn && "translate-x-4")} />
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{t("sleep.sensorSub")}</span>
                </span>
              </button>
              {sensorOn && (
                <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-muted-foreground/80">
                  <BatteryCharging className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {t("sleep.sensorWarn")}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-[10.5px] leading-snug text-muted-foreground/70">
              {apk ? t("sleep.sensorWeb") : t("sleep.sensorWeb")}
            </p>
          )}
        </SectionCard>
      )}

      {/* ─── Bugungi norma: bo'lib-bo'lib yig'iladi, yetish/oshish kuzatiladi (v1.10) ─── */}
      <SectionCard>
        <SectionHead
          icon={<Gauge className="h-4 w-4" />}
          title={t("sleep.todayTitle")}
          sub={t("sleep.todaySub")}
        />
        {todayRow && todayRow.segs.length > 0 ? (
          <>
            <div className="mb-2 flex items-end justify-between gap-2">
              <p className="text-2xl font-extrabold leading-none tabular-nums">
                {fmtMinutes(todayRow.totalMin, t)}
                <span className="ml-1.5 text-xs font-semibold text-muted-foreground">/ {goalH}h</span>
              </p>
              <Chip
                className={cn(
                  "tabular-nums",
                  todayRow.totalMin >= goalMin
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {todayPct}%
              </Chip>
            </div>
            {/* Progress: normaldan oshsa — 100% to'ldirilgandan keyin emerald chiziq */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  todayRow.totalMin >= goalMin ? "bg-emerald-500" : "brand-grad"
                )}
                style={{ width: `${Math.min(100, todayPct)}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-2 text-[11.5px] font-semibold",
                todayRow.totalMin >= goalMin ? "text-emerald-500" : "text-amber-500"
              )}
            >
              {leftMin > 0
                ? t("sleep.todayLeft", { d: fmtMinutes(leftMin, t) })
                : overMin > 0
                  ? t("sleep.todayOver", { d: fmtMinutes(overMin, t) })
                  : t("sleep.todayHit")}
            </p>
            {/* Kundagi bo'limlar: tun + tushlik uyqusi */}
            {todayRow.segs.length > 1 && (
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                {t("sleep.todaySegs", { n: todayRow.segs.length })}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {todayRow.segs.map((sg, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex items-center gap-1 rounded-xl px-2 py-1 text-[10.5px] font-semibold tabular-nums",
                    sg.kind === "night"
                      ? "bg-violet-500/12 text-violet-600 dark:text-violet-300"
                      : "bg-amber-500/12 text-amber-600 dark:text-amber-300"
                  )}
                >
                  {sg.kind === "night" ? <Moon className="h-3 w-3" /> : <Coffee className="h-3 w-3" />}
                  {sg.start}→{sg.end} · {fmtMinutes(sg.min, t)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">{t("sleep.todayEmpty")}</p>
        )}
        <button
          onClick={() => {
            setMErr(null);
            setManOpen(true);
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-500/40 py-3 text-sm font-bold text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-300"
        >
          <Plus className="h-4 w-4" />
          {t("sleep.manualTitle")}
        </button>
      </SectionCard>

      {/* ─── Sozlamalar ─── */}
      <SectionCard>
        <SectionHead icon={<Gauge className="h-4 w-4" />} title={t("sleep.goal")} sub={t("sleep.goalShort", { h: goalH })} />
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setSettings({ sleepGoalH: g })}
              className={cn(
                "rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95",
                goalH === g
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {g} {t("sleep.h", { n: "" }).trim()}
            </button>
          ))}
        </div>

        {/* Yotish eslatmasi — yoq/o'chir toggle. Vaqt alohida qatorda: har doim
            tahrirlanadi, toggle yoqilganda majburiy 23:00 yozilmaydi — oxirgi
            o'zgartirilgan vaqt qaytadi (v1.10 tuzatish) */}
        <button
          onClick={() => {
            if (bedtime) {
              // O'chirish: oxirgi vaqtni eslab qolamiz + foydalanuvchi boshqaruvda —
              // aqili rejim uni qayta yoqmaydi (holat esdan chiqmaydi)
              setSettings({ sleepBedtime: null, sleepBedtimePrev: bedtime, sleepBedtimeManual: true });
            } else {
              setSettings({ sleepBedtime: settings.sleepBedtimePrev ?? "23:00" });
            }
          }}
          className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 p-3 text-left"
        >
          <span className={cn("rounded-xl p-2", bedtime ? "bg-indigo-500/15 text-indigo-500" : "bg-background text-muted-foreground")}>
            <BedDouble className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t("sleep.bedtime")}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {bedtime ? t("sleep.bedtimeHint", { n: settings.sleepWindMin ?? 30 }) : t("common.none")}
            </span>
          </span>
          <span className={cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors", bedtime ? "bg-indigo-500" : "bg-muted-foreground/25")}>
            <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", bedtime && "translate-x-5")} />
          </span>
        </button>

        {bedtime ? (
          <>
            {/* Eslatma vaqti — to'liq alohida qator: istalgan payt o'zgartiriladi */}
            <p className="mb-1.5 mt-3 text-[11px] font-semibold text-muted-foreground">{t("sleep.bedtimeAt")}</p>
            <input
              type="time"
              value={bedtime}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setSettings({ sleepBedtime: v, sleepBedtimePrev: v, sleepBedtimeManual: true });
              }}
              className="w-full rounded-2xl bg-muted/60 px-3 py-3 text-base font-extrabold tabular-nums outline-none"
            />
            {/* Tezkor tanlovlar — bir bosishda */}
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {BEDTIMES.map((bt) => (
                <button
                  key={bt}
                  onClick={() => setSettings({ sleepBedtime: bt, sleepBedtimePrev: bt, sleepBedtimeManual: true })}
                  className={cn(
                    "rounded-xl border py-2 text-[11px] font-bold tabular-nums transition-all active:scale-95",
                    bedtime === bt
                      ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {bt}
                </button>
              ))}
            </div>
            {/* Wind-down daqiqasi — foydalanuvchi tanlaydi (majburiy emas) */}
            <p className="mb-1.5 mt-3 text-[11px] font-semibold text-muted-foreground">{t("sleep.windMin")}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {WINDS.map((n) => (
                <button
                  key={n}
                  onClick={() => setSettings({ sleepWindMin: n })}
                  className={cn(
                    "rounded-xl border py-2 text-[11px] font-bold tabular-nums transition-all active:scale-95",
                    (settings.sleepWindMin ?? 30) === n
                      ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {n} {t("sleep.minShort")}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[10.5px] leading-snug text-amber-600 dark:text-amber-300">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("sleep.bedtimeOff")}
          </p>
        )}
      </SectionCard>

      {/* ─── Statistika: 7 kun ─── */}
      <SectionCard>
        <SectionHead icon={<Timer className="h-4 w-4" />} title={t("sleep.week")} />
        <div className="relative mb-2 flex h-36 items-end gap-1.5">
          {/* maqsad chizig'i */}
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-violet-500/50"
            style={{ bottom: `${Math.min(100, (goalMin / maxScale) * 100)}%` }}
          >
            <span className="absolute -top-4 right-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-500">
              {goalH}h
            </span>
          </div>
          {series.map((d) => {
            const h = d.sleepMin > 0 ? Math.max(4, (d.sleepMin / maxScale) * 100) : 0;
            const color = d.score == null ? "bg-muted-foreground/40" : d.score >= 80 ? "bg-emerald-500" : d.score >= 60 ? "bg-amber-500" : "bg-rose-500";
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] font-semibold tabular-nums text-muted-foreground">
                  {d.sleepMin > 0 ? `${Math.round(d.sleepMin / 60)}h` : ""}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-lg transition-all", d.sleepMin > 0 ? color : "bg-muted")}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {new Date(d.date + "T12:00").toLocaleDateString([], { weekday: "narrow" })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatCell label={t("sleep.avg")} value={avg7 ? fmtMinutes(avg7, t) : "—"} />
          <StatCell
            label={t("sleep.debt")}
            value={debt > 0 ? fmtMinutes(debt, t) : t("sleep.debtNone")}
            tone={debt > 120 ? "bad" : debt > 0 ? "warn" : "good"}
          />
          <StatCell label={t("sleep.consistency")} value={consistency != null ? `${consistency}%` : "—"} />
        </div>
      </SectionCard>

      {/* ─── Kun bo'yicha parchalar: kundagi barcha yotish joylari (v1.9) ─── */}
      <SectionCard>
        <SectionHead
          icon={<Layers className="h-4 w-4" />}
          title={t("sleep.segsTitle")}
          sub={t("sleep.segsSub")}
        />
        {segRows.every((r) => r.segs.length === 0) ? (
          <p className="rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">{t("sleep.segsEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {segRows
              .slice()
              .reverse()
              .map((row) => {
                const d = new Date(row.date + "T12:00");
                const has = row.segs.length > 0;
                return (
                  <div key={row.date} className="rounded-2xl bg-muted/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{fmtShortDate(d, lang)}</span>
                      {has && (
                        <Chip
                          className={cn(
                            "tabular-nums",
                            row.totalMin >= goalMin
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {fmtMinutes(row.totalMin, t)}
                          {row.totalMin >= goalMin ? " ✓" : ""}
                        </Chip>
                      )}
                      {row.napMin > 0 && (
                        <Chip className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Coffee className="h-3 w-3" /> {fmtMinutes(row.napMin, t)}
                        </Chip>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {has ? `${row.segs.length} ${t("sleep.segCount")}` : t("sleep.segNone")}
                      </span>
                    </div>
                    {has && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.segs.map((sg, i) => (
                          <span
                            key={i}
                            className={cn(
                              "flex items-center gap-1 rounded-xl px-2 py-1 text-[10.5px] font-semibold tabular-nums",
                              sg.kind === "night"
                                ? "bg-violet-500/12 text-violet-600 dark:text-violet-300"
                                : "bg-amber-500/12 text-amber-600 dark:text-amber-300"
                            )}
                          >
                            {sg.kind === "night" ? <Moon className="h-3 w-3" /> : <Coffee className="h-3 w-3" />}
                            {sg.start}→{sg.end} · {fmtMinutes(sg.min, t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </SectionCard>

      {/* ─── Yotish odatlari: qaysi paytlarda yotgani (v1.9) ─── */}
      <SectionCard>
        <SectionHead
          icon={<Sunrise className="h-4 w-4" />}
          title={t("sleep.patTitle")}
          sub={pat.ok ? t("sleep.patSub", { n: pat.nights }) : t("sleep.patNeed")}
        />
        {pat.ok ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label={t("sleep.patBed")} value={pat.avgBed} sub={pat.bedSd > 0 ? `±${pat.bedSd} ${t("sleep.minShort")}` : undefined} />
              <StatCell label={t("sleep.patWake")} value={pat.avgWake} />
              <StatCell label={t("sleep.patDur")} value={fmtMinutes(pat.avgNightMin, t)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pat.jetlagMin != null && Math.abs(pat.jetlagMin) >= 45 && (
                <Chip className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {pat.jetlagMin > 0
                    ? t("sleep.patJet+", { d: Math.abs(pat.jetlagMin) })
                    : t("sleep.patJet-", { d: Math.abs(pat.jetlagMin) })}
                </Chip>
              )}
              {pat.naps7 > 0 && (
                <Chip className="border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300">
                  <Coffee className="h-3 w-3" /> {t("sleep.patNaps", { n: pat.naps7, m: pat.napMin7 })}
                </Chip>
              )}
              <Chip className="border-border bg-secondary text-secondary-foreground">
                {t("sleep.patRange", { a: pat.earliest, b: pat.latest })}
              </Chip>
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">{t("sleep.patEmpty")}</p>
        )}
      </SectionCard>

      {/* ─── Aqili tavsiyalar: budilnik ↔ uyqu ↔ vazifalar bog'lovi (v1.9) ─── */}
      {(advices.length > 0 || link.ok) && (
        <SectionCard className="border-violet-500/20 bg-gradient-to-b from-violet-500/[0.05] to-transparent">
          <SectionHead
            icon={<Lightbulb className="h-4 w-4" />}
            title={t("sad.title")}
            sub={t("sad.sub")}
            accent="text-violet-500"
          />
          {link.ok && (
            <p className="mb-2 rounded-2xl bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
              {t("sad.link", { g: link.goodDone.toFixed(1), b: Math.max(1, Math.round(link.badDone)) , gd: link.goodDays, bd: link.badDays })}
            </p>
          )}
          {advices.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">{t("sad.empty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {advices.map((ad, i) => {
                const id = `${ad.key}:${i}`;
                const done = applied.has(id);
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "flex items-start gap-2.5 rounded-2xl px-3 py-2.5",
                      ad.tone === "warn" ? "bg-amber-500/10" : ad.tone === "good" ? "bg-emerald-500/10" : "bg-muted/60"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0",
                        ad.tone === "warn" ? "text-amber-500" : ad.tone === "good" ? "text-emerald-500" : "text-violet-500"
                      )}
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed">{t(ad.key, ad.vars)}</p>
                      {ad.action && !done && ad.action.kind !== "openSleep" && (
                        <button
                          onClick={() => applyAdvice(id, ad.action!)}
                          className="mt-1.5 rounded-xl bg-violet-500/15 px-3 py-1.5 text-[11px] font-bold text-violet-600 transition-colors hover:bg-violet-500/25 dark:text-violet-300"
                        >
                          {t(ad.actionKey ?? "sad.apply")}
                        </button>
                      )}
                      {done && (
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-500">
                          ✓ {t("sad.applied")}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ─── Oxirgi sessiya tahlili ─── */}
      {last && lastAnalysis && (
        <SectionCard>
          <SectionHead
            icon={<MoonStar className="h-4 w-4" />}
            title={t("sleep.lastNight")}
            sub={
              last.sensor
                ? t("sleep.sensorData")
                : t("sleep.manualData") + " · " + t("sleep.estimate")
            }
          />
          <div className="mb-3 flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg width="80" height="80" className="-rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" className="stroke-muted" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - lastAnalysis.score / 100)}
                  className={lastAnalysis.score >= 80 ? "stroke-emerald-500" : lastAnalysis.score >= 60 ? "stroke-amber-500" : "stroke-rose-500"}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold leading-none">{lastAnalysis.score}</span>
                <span className="text-[8.5px] text-muted-foreground">{t("sleep.score")}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold leading-tight">{fmtMinutes(lastAnalysis.sleepMin, t)}</p>
              <p className="text-[11px] text-muted-foreground">
                {last.end ? fmtShortDate(parseLocal(last.end) ?? new Date(), lang) : ""}
                {" · "}
                {t("sleep.cycles", { c: lastAnalysis.cycles })}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-violet-500">
                {lastAnalysis.score >= 80 ? t("sleep.scoreGreat") : lastAnalysis.score >= 60 ? t("sleep.scoreOk") : t("sleep.scoreLow")}
              </p>
            </div>
          </div>

          {/* Bosqichlar: stack bar + legend */}
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.stages")}</p>
          {(() => {
            const st = lastAnalysis.stages;
            const total = Math.max(1, st.deep + st.light + st.rem + st.awake);
            const segs: { k: keyof typeof st; cls: string }[] = [
              { k: "deep", cls: "bg-indigo-500" },
              { k: "light", cls: "bg-teal-500" },
              { k: "rem", cls: "bg-violet-500" },
              { k: "awake", cls: "bg-rose-400" },
            ];
            return (
              <>
                <div className="mb-2 flex h-4 w-full overflow-hidden rounded-full bg-muted">
                  {segs.map(({ k, cls }) =>
                    st[k] > 0 ? <div key={k} className={cls} style={{ width: `${(st[k] / total) * 100}%` }} /> : null
                  )}
                </div>
                <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1">
                  {segs.map(({ k, cls }) => (
                    <div key={k} className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn("h-2 w-2 rounded-full", cls)} />
                      <span className="text-muted-foreground">{t(`sleep.${k === "deep" ? "deep" : k === "light" ? "light" : k === "rem" ? "rem" : "awake"}`)}</span>
                      <span className="ml-auto font-semibold tabular-nums">
                        {fmtMinutes(st[k], t)} · {Math.round((st[k] / total) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
                {/* Fikrlar */}
                <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-3">
                  {buildInsights(last, lastAnalysis, goalMin, t).map((line, i) => (
                    <p key={i} className="text-[11.5px] leading-snug text-muted-foreground">• {line}</p>
                  ))}
                </div>
              </>
            );
          })()}
        </SectionCard>
      )}

      {/* ─── Sessiyalar ro'yxati ─── */}
      <SectionCard>
        <SectionHead icon={<Square className="h-3.5 w-3.5" />} title={t("sleep.sessions")} />
        {sessions.length === 0 ? (
          <EmptyState icon={<Moon className="h-6 w-6" />} title={t("sleep.noSessions")} hint={t("sleep.noSessionsHint")} className="py-6" />
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {[...sessions]
              .sort((a, b) => (parseLocal(b.end)?.getTime() ?? 0) - (parseLocal(a.end)?.getTime() ?? 0))
              .slice(0, 14)
              .map((s) => {
                const a = analyzeSleep(s, goalH);
                const e = parseLocal(s.end);
                const kind = sessionKind(s);
                return (
                  <div key={s.id} className="flex items-center gap-2.5 py-2.5">
                    <span
                      className={cn(
                        "rounded-lg p-1.5",
                        s.sensor
                          ? "bg-teal-500/12 text-teal-500"
                          : kind === "nap"
                            ? "bg-amber-500/12 text-amber-500"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.sensor ? <Waves className="h-3.5 w-3.5" /> : kind === "nap" ? <Coffee className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">
                        {e ? fmtShortDate(e, lang) : ""}
                        {" · "}
                        {fmtMinutes(a?.sleepMin ?? 0, t)}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {s.start.slice(11, 16)} → {s.end.slice(11, 16)}
                        {s.sensor ? " · " + t("sleep.sensorData") : ""}
                        {s.manual ? " · " + t("sleep.manualTag") : ""}
                        {kind === "nap" ? " · " + t("sleep.isNap") : ""}
                      </p>
                    </div>
                    {s.score != null && (
                      <Chip
                        className={cn(
                          "tabular-nums",
                          s.score >= 80
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : s.score >= 60
                              ? "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {s.score}
                      </Chip>
                    )}
                    <button
                      onClick={() => deleteSleepSession(s.id)}
                      aria-label={t("common.delete")}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </SectionCard>

      {/* ─── Uyg'onish dialogi ─── */}
      {stopOpen && active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setStopOpen(false)}>
          <motion.div
            initial={{ y: 320 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">{t("sleep.stopTitle")}</h3>
              <button onClick={() => setStopOpen(false)} aria-label={t("common.close")} className="rounded-xl bg-muted p-2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.quality")}</p>
            <div className="mb-4 flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  aria-label={`${q}`}
                  className={cn("text-2xl transition-transform active:scale-90", q <= quality ? "text-amber-400" : "text-muted-foreground/30")}
                >
                  ★
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.latency")}</p>
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              {[
                { v: 5, k: "sleep.latFast" },
                { v: 15, k: "sleep.latMid" },
                { v: 30, k: "sleep.latSlow" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setLat(o.v)}
                  className={cn(
                    "rounded-xl border py-2.5 text-[11px] font-semibold transition-all active:scale-95",
                    lat === o.v ? "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300" : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {t(o.k)}
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.wakings")}</p>
            <div className="mb-5 grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setWakings(n)}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95",
                    wakings === n ? "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300" : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {n === 3 ? "3+" : t("sleep.times", { n })}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={discard} className="rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/20">
                {t("sleep.dropConfirm")}
              </button>
              <button onClick={confirmStop} disabled={busy} className="brand-grad flex-1 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60">
                {t("sleep.saveSession")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Bekor qilish tasdig'i ─── */}
      {dropAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={() => setDropAsk(false)}>
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-3xl border bg-popover p-5"
          >
            <h3 className="text-base font-bold">{t("sleep.dropTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("sleep.dropBody")}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDropAsk(false)} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
                {t("common.close")}
              </button>
              <button onClick={discard} className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white hover:bg-rose-600">
                {t("sleep.dropConfirm")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* ─── Qo'lda kiritish dialogi (v1.10): esdan chiqqan yotishni yozish ─── */}
      {manOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setManOpen(false)}>
          <motion.div
            initial={{ y: 320 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold">{t("sleep.manualTitle")}</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t("sleep.manualSub")}</p>
              </div>
              <button onClick={() => setManOpen(false)} aria-label={t("common.close")} className="rounded-xl bg-muted p-2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.mDate")}</p>
            <input
              type="date"
              value={mDate}
              onChange={(e) => setMDate(e.target.value)}
              className="w-full rounded-2xl bg-muted/60 px-3 py-3 text-sm font-bold tabular-nums outline-none"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.mBed")}</p>
                <input
                  type="time"
                  value={mBed}
                  onChange={(e) => setMBed(e.target.value || "23:30")}
                  className="w-full rounded-2xl bg-muted/60 px-3 py-3 text-sm font-bold tabular-nums outline-none"
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("sleep.mUp")}</p>
                <input
                  type="time"
                  value={mUp}
                  onChange={(e) => setMUp(e.target.value || "07:00")}
                  className="w-full rounded-2xl bg-muted/60 px-3 py-3 text-sm font-bold tabular-nums outline-none"
                />
              </div>
            </div>

            {mErr && <p className="mt-2 text-[11px] font-semibold text-rose-500">{mErr}</p>}

            <button
              onClick={saveManual}
              className="brand-grad mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white transition-transform active:scale-[0.99]"
            >
              {t("sleep.mSave")}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 px-2 py-2.5 text-center">
      <p
        className={cn(
          "text-[13px] font-extrabold leading-tight tabular-nums",
          tone === "bad" && "text-rose-500",
          tone === "warn" && "text-amber-500",
          tone === "good" && "text-emerald-500"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[9px] text-muted-foreground/80">{sub}</p>}
      <p className="mt-0.5 text-[9.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Oxirgi sessiya uchun fikrlar (i18n kalitlari bilan) */
function buildInsights(
  s: SleepSession,
  a: NonNullable<ReturnType<typeof analyzeSleep>>,
  goalMin: number,
  t: (k: string, v?: Record<string, string | number>) => string
): string[] {
  const out: string[] = [];
  const h = Math.floor(a.sleepMin / 60);
  const m = Math.round(a.sleepMin % 60);
  if (a.sleepMin >= goalMin) {
    out.push(a.sleepMin > goalMin + 60 ? t("sleep.ins.over", { h, m, d: a.sleepMin - goalMin }) : t("sleep.ins.good", { h, m }));
  } else {
    out.push(t("sleep.ins.short", { h, m, d: goalMin - a.sleepMin }));
  }
  const rest = Math.max(1, a.sleepMin);
  const deepShare = Math.round((a.stages.deep / rest) * 100);
  if (deepShare >= 15) out.push(t("sleep.ins.deepGood", { p: deepShare }));
  else out.push(t("sleep.ins.deepLow"));
  if ((s.wakings ?? 0) >= 2) out.push(t("sleep.ins.wakeMany", { n: s.wakings ?? 0 }));
  if (a.latencyMin <= 10) out.push(t("sleep.ins.latGood"));
  else if (a.latencyMin >= 30) out.push(t("sleep.ins.latLong"));
  return out.slice(0, 4);
}
