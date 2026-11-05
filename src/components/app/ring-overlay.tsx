"use client";

/**
 * ─── Zang oynasi — to'liq ekran, o'chmaydigan signal (PRD 4.7 + v1.8) ────────
 * • Missiyalar (Mission Alarm uslubi): zanjir bo'lib bajariladi — barchasi
 *   tugaguncha "To'xtatish" ochilmaydi (bosib o'chib bo'lmaydi).
 * • Aqili rejim: missiya tartibi har zangda aralashadi, agar oldingi safar
 *   snooze bosilgan bo'lsa qiyinlik avtomatik bir daraja oshadi.
 * • Snooze: budilnikdagi cheklov bo'yicha (soni/davomiyligi, to'liq o'chirish
 *   ham mumkin).
 * • Ovoz: WebAudio jiringlash tsikli; yengil uyg'otishda ovoz asta-sekin
 *   kuchayadi. Tebranish har tsiklda (APK'da bildirishnoma ham alarm ovozini
 *   beradi).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Check, Moon, Sparkles, Timer, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissionDifficulty, MissionType, PendingRing } from "@/lib/types";
import { fmtMinutes, parseLocal } from "@/lib/utils-app";
import { useStore } from "@/lib/store";
import { sleepDebt, weeklySeries } from "@/lib/sleep";
import { MissionRunner, shuffle } from "./missions";

interface Props {
  ring: PendingRing;
  t: (k: string, v?: Record<string, string | number>) => string;
  onDismiss: () => void;
  onSnooze: (min: number) => void;
}

export default function RingOverlay({ ring, t, onDismiss, onSnooze }: Props) {
  // ─── Missiya zanjiri: aqili rejimda tartib har zangda aralashadi ───
  const missions: MissionType[] = useMemo(() => {
    const base: MissionType[] =
      ring.missions && ring.missions.length ? ring.missions : ring.challenge ? ["math"] : [];
    return ring.smart ? shuffle(base) : base;
    // faqat birinchi renderda aniqlanadi — zang davomida o'zgarmasin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Moslashuvchan qiyinlik (aqili rejim): oldingi zang snooze bo'lsa +1 daraja ───
  const { difficulty, bumped } = useMemo(() => {
    const base: MissionDifficulty = ring.difficulty ?? "medium";
    if (!ring.smart || !ring.alarmId) return { difficulty: base, bumped: false };
    const stat = useStore.getState().alarmStats[ring.alarmId];
    const order: MissionDifficulty[] = ["easy", "medium", "hard"];
    let i = order.indexOf(base);
    if (stat && (stat.last === "snooze" || stat.snoozes >= 2) && i < order.length - 1) {
      return { difficulty: order[i + 1], bumped: true };
    }
    return { difficulty: base, bumped: false };
    // faqat birinchi renderda aniqlanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [allDone, setAllDone] = useState(missions.length === 0);
  const [now, setNow] = useState(() => new Date());
  const audioRef = useRef<{ ctx: AudioContext; iv: number; master: GainNode } | null>(null);
  const vibRef = useRef<number | null>(null);

  // ─── Ovoz: jiringlash tsikli; yengil uyg'otishda ovoz asta-sekin kuchayadi ──
  useEffect(() => {
    const gentle = ring.gentle;
    let cycle = 0;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      void ctx.resume();
      const master = ctx.createGain();
      master.gain.value = gentle ? 0.03 : 0.22;
      master.connect(ctx.destination);
      const beep = (freq: number, at: number, dur = 0.16) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(1, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g).connect(master);
        o.start(at);
        o.stop(at + dur + 0.02);
      };
      const iv = window.setInterval(() => {
        // yengil uyg'otish: har tsiklda ovoz +~35%, 0.22 da to'xtaydi (≈40 sekund)
        if (gentle) {
          cycle += 1;
          master.gain.setTargetAtTime(Math.min(0.22, 0.03 + cycle * 0.035), ctx.currentTime, 0.2);
        }
        const t0 = ctx.currentTime;
        beep(880, t0 + 0.0);
        beep(1174, t0 + 0.22);
        beep(880, t0 + 0.44);
        beep(1174, t0 + 0.66);
      }, 1400);
      beep(880, ctx.currentTime);
      beep(1174, ctx.currentTime + 0.22);
      audioRef.current = { ctx, iv, master };
    } catch {
      /* audio yo'q */
    }
    // ── Tebranish (APK webview'da ishlaydi) ──
    try {
      const vibrate = () => navigator.vibrate?.([420, 180, 420, 700]);
      vibrate();
      vibRef.current = window.setInterval(vibrate, 1800);
    } catch {
      /* ignore */
    }
    return () => {
      if (audioRef.current) {
        clearInterval(audioRef.current.iv);
        void audioRef.current.ctx.close();
        audioRef.current = null;
      }
      if (vibRef.current) {
        clearInterval(vibRef.current);
        navigator.vibrate?.(0);
        vibRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // jonli soat
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const atDate = parseLocal(ring.at);
  const atStr = useMemo(() => {
    if (!atDate) return "--:--";
    return `${String(atDate.getHours()).padStart(2, "0")}:${String(atDate.getMinutes()).padStart(2, "0")}`;
  }, [atDate]);
  const lateMin = atDate ? Math.max(0, Math.round((now.getTime() - atDate.getTime()) / 60000)) : 0;

  // ─── Snooze cheklovi: null = cheklovsiz, 0 = yo'q, N = shuncha marta ───
  const snoozeMin = ring.snoozeMin ?? 5;
  const snoozeUsed = ring.snoozeUsed ?? 0;
  const snoozeLeft = ring.snoozeLimit == null ? null : Math.max(0, ring.snoozeLimit - snoozeUsed);
  const snoozeBlocked = ring.snoozeLimit === 0 || (snoozeLeft != null && snoozeLeft <= 0);

  // ─── Uyqu qarzi (v1.9): budilnik ↔ uyqu bog'lovi — zang paytida ko'rsatiladi ──
  const debtMin = useMemo(() => {
    if (ring.kind !== "alarm") return 0;
    const st = useStore.getState();
    const goalMin = (st.settings.sleepGoalH ?? 8) * 60;
    return sleepDebt(weeklySeries(st.sleepSessions, 7), goalMin);
    // faqat birinchi renderda hisoblanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showDebt = debtMin >= 120;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#1a1030] via-[#12101c] to-[#0c0a14] px-6 pb-safe pt-safe"
    >
      {/* pulsing halo */}
      <div className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2">
        <motion.div
          animate={{ scale: [1, 1.35, 1], opacity: [0.28, 0.08, 0.28] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-56 w-56 rounded-full bg-rose-500/40 blur-3xl"
        />
      </div>

      {/* ─── Yuqori: belgi + nom ─── */}
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <motion.span
          animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
          className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-rose-500/15 text-rose-400"
        >
          <BellRing className="h-10 w-10" strokeWidth={1.8} />
        </motion.span>
        {ring.kind === "task" && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400">
            {t("ring.taskBadge")}
          </span>
        )}
        <h1 className="max-w-[86vw] text-2xl font-bold leading-tight text-white">
          {ring.title || t("more.alarm")}
        </h1>
        {bumped && (
          <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold text-violet-300">
            <Sparkles className="h-3 w-3" />
            {t("mission.adaptive")}
          </span>
        )}
      </div>

      {/* ─── Markaz: soat ─── */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="text-[76px] font-extrabold leading-none tracking-tight text-white tabular-nums">
          {atStr}
        </p>
        {lateMin > 0 && (
          <p className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300">
            {t("ring.late", { t: `${lateMin} min` })}
          </p>
        )}
        {showDebt && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-1 flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-300"
          >
            <Moon className="h-3 w-3" />
            {t("ring.debt", { d: fmtMinutes(debtMin, t) })}
          </motion.p>
        )}
        <p className="mt-2 text-[13px] tabular-nums text-white/40">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>

      {/* ─── Pastki: missiyalar + tugmalar ─── */}
      <div className="mb-8 w-full max-w-[420px]">
        {missions.length > 0 && (
          <div className="mb-4">
            {!allDone ? (
              <MissionRunner missions={missions} difficulty={difficulty} t={t} onAllPass={() => setAllDone(true)} />
            ) : (
              <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-emerald-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  {t("mission.allDone")}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={() => onSnooze(snoozeMin)}
            disabled={snoozeBlocked}
            title={snoozeBlocked ? t("ring.snoozeOff") : undefined}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold transition-colors",
              snoozeBlocked
                ? "cursor-not-allowed bg-white/[0.06] text-white/30"
                : "bg-white/10 text-white/85 hover:bg-white/20"
            )}
          >
            {snoozeBlocked ? <TimerOff className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
            {snoozeBlocked
              ? t("ring.snoozeOff")
              : snoozeLeft != null
                ? t("ring.snoozeLeft", { m: snoozeMin, n: snoozeLeft })
                : t("ring.snoozeMin", { m: snoozeMin })}
          </button>
          <button
            onClick={onDismiss}
            disabled={!allDone}
            className={cn(
              "flex-1 rounded-2xl py-4 text-base font-extrabold transition-all",
              allDone
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 hover:bg-rose-600 active:scale-[0.98]"
                : "cursor-not-allowed bg-white/[0.06] text-white/30"
            )}
          >
            {t("ring.stop")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
