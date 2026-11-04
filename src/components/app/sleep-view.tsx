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
import { inApkEnv } from "@/lib/notify";
import { sensorAvailable, sensorStart, sensorStop } from "@/lib/sleep-sensor";
import { fmtMinutes, fmtShortDate, isoLocal, parseLocal, uuidv7 } from "@/lib/utils-app";
import type { SleepSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BatteryCharging,
  BedDouble,
  Footprints,
  Gauge,
  Moon,
  MoonStar,
  Play,
  Square,
  Timer,
  Trash2,
  Waves,
  X,
} from "lucide-react";

const GOALS = [6, 7, 8, 9];

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

  const startSleep = async () => {
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
    setSleepActive({ id, start: isoLocal(new Date()), sensor });
  };

  const confirmStop = async () => {
    if (!active) return;
    setBusy(true);
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
      latencyMin: lat,
      wakings,
      quality,
      motion,
      sensor: active.sensor,
    };
    const a = analyzeSleep(sess, goalH);
    if (a) {
      sess.stages = a.stages;
      sess.score = a.score;
    }
    addSleepSession(sess);
    setBusy(false);
    setStopOpen(false);
    import("sonner").then(({ toast }) =>
      toast.success(t("sleep.saved") + (sess.score != null ? ` · ${t("sleep.score")}: ${sess.score}` : ""))
    );
  };

  const discard = () => {
    if (active?.sensor) void sensorStop();
    setSleepActive(null);
    setDropAsk(false);
    setStopOpen(false);
    import("sonner").then(({ toast }) => toast(t("sleep.discarded")));
  };

  const elapsedMin = active ? Math.max(0, Math.round((now - (parseLocal(active.start)?.getTime() ?? now)) / 60000)) : 0;

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
              onClick={startSleep}
              disabled={busy}
              className="brand-grad flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {t("sleep.start")}
            </button>
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

        <button
          onClick={() =>
            setSettings({ sleepBedtime: bedtime ? null : "23:00" })
          }
          className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 p-3 text-left"
        >
          <span className={cn("rounded-xl p-2", bedtime ? "bg-indigo-500/15 text-indigo-500" : "bg-background text-muted-foreground")}>
            <BedDouble className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{t("sleep.bedtime")}</span>
              {bedtime && (
                <input
                  type="time"
                  value={bedtime}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setSettings({ sleepBedtime: e.target.value || null })}
                  className="rounded-xl bg-background px-2.5 py-1.5 text-sm font-bold tabular-nums outline-none"
                />
              )}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {bedtime ? t("sleep.bedtimeHint", { n: settings.sleepWindMin ?? 30 }) : t("common.none")}
            </span>
          </span>
          <span className={cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors", bedtime ? "bg-indigo-500" : "bg-muted-foreground/25")}>
            <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", bedtime && "translate-x-5")} />
          </span>
        </button>
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
                return (
                  <div key={s.id} className="flex items-center gap-2.5 py-2.5">
                    <span className={cn("rounded-lg p-1.5", s.sensor ? "bg-teal-500/12 text-teal-500" : "bg-muted text-muted-foreground")}>
                      {s.sensor ? <Waves className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">
                        {last.end ? fmtShortDate(parseLocal(last.end) ?? new Date(), lang) : ""}
                        {" · "}
                        {fmtMinutes(a?.sleepMin ?? 0, t)}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {s.start.slice(11, 16)} → {s.end.slice(11, 16)}
                        {s.sensor ? " · " + t("sleep.sensorData") : ""}
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
    </div>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
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
