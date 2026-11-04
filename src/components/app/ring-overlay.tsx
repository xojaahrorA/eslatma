"use client";

/**
 * ─── Zang oynasi — to'liq ekran, o'chmaydigan signal (PRD 4.7) ──────────────
 * • Challenge yoqilgan bo'lsa: "To'xtatish" tugmasi faqat misol yechilgach
 *   ochiladi (bosib o'chib bo'lmaydi — bajargandan keyin o'chadi).
 * • "+5 daqiqa" (snooze) — har qanday holatda mavjud.
 * • Ovoz: WebAudio ikki tonli jiringlash tsikli + tebranish (APK'da
 *   bildirishnoma o'zi ham alarm ovozini beradi).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlarmClock, BellRing, Check, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingRing } from "@/lib/types";
import { parseLocal } from "@/lib/utils-app";

interface Props {
  ring: PendingRing;
  t: (k: string, v?: Record<string, string | number>) => string;
  onDismiss: () => void;
  onSnooze: (min: number) => void;
}

function makeChallenge(): { a: number; b: number; c: number; ans: number } {
  const a = 6 + Math.floor(Math.random() * 7); // 6..12
  const b = 6 + Math.floor(Math.random() * 7); // 6..12
  const c = 21 + Math.floor(Math.random() * 68); // 21..88
  return { a, b, c, ans: a * b + c };
}

export default function RingOverlay({ ring, t, onDismiss, onSnooze }: Props) {
  const needChallenge = ring.challenge;
  const [chal, setChal] = useState(() => (needChallenge ? makeChallenge() : null));
  const [val, setVal] = useState("");
  const [solved, setSolved] = useState(!needChallenge);
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const audioRef = useRef<{ ctx: AudioContext; iv: number } | null>(null);
  const vibRef = useRef<number | null>(null);

  // ── Ovoz: ikki tonli jiringlash tsikli (AudioContext bloklansa — jaranglamaydi,
  //     lekin APK'da bildirishnoma ovozi baribir chalindi) ──
  useEffect(() => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      void ctx.resume();
      const beep = (freq: number, at: number, dur = 0.16) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g).connect(ctx.destination);
        o.start(at);
        o.stop(at + dur + 0.02);
      };
      const iv = window.setInterval(() => {
        const t0 = ctx.currentTime;
        beep(880, t0 + 0.0);
        beep(1174, t0 + 0.22);
        beep(880, t0 + 0.44);
        beep(1174, t0 + 0.66);
      }, 1400);
      // birinchi tsilni darhol chal
      beep(880, ctx.currentTime);
      beep(1174, ctx.currentTime + 0.22);
      audioRef.current = { ctx, iv };
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

  const check = () => {
    if (!chal) return;
    if (Number(val.trim()) === chal.ans) {
      setSolved(true);
      setWrong(false);
    } else {
      setWrong(true);
      setVal("");
      setTimeout(() => setWrong(false), 900);
    }
  };

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
        <p className="mt-2 text-[13px] tabular-nums text-white/40">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>

      {/* ─── Pastki: challenge + tugmalar ─── */}
      <div className="mb-8 w-full max-w-[420px]">
        {needChallenge && chal && (
          <div
            className={cn(
              "mb-4 rounded-3xl border p-4",
              wrong ? "border-rose-500/60 bg-rose-500/10" : solved ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.04]"
            )}
          >
            {!solved ? (
              <>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70">
                  <AlarmClock className="h-3.5 w-3.5" />
                  {t("ring.challengeTitle")}
                </p>
                <p className="text-center text-[28px] font-extrabold tabular-nums text-white">
                  {chal.a} × {chal.b} + {chal.c} = ?
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={val}
                    onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && check()}
                    placeholder={t("ring.answerPh")}
                    className={cn(
                      "flex-1 rounded-2xl bg-black/30 px-4 py-3 text-center text-lg font-bold tabular-nums text-white outline-none placeholder:text-white/30",
                      wrong && "ring-2 ring-rose-500"
                    )}
                  />
                  <button
                    onClick={check}
                    className="rounded-2xl bg-white/10 px-5 text-sm font-bold text-white transition-colors hover:bg-white/20"
                  >
                    {t("ring.check")}
                  </button>
                </div>
                {wrong && <p className="mt-2 text-center text-xs font-semibold text-rose-400">{t("ring.wrong")}</p>}
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-emerald-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                {t("ring.solved")}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={() => onSnooze(5)}
            className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-sm font-bold text-white/85 transition-colors hover:bg-white/20"
          >
            <Timer className="h-4 w-4" />
            {t("ring.snooze")}
          </button>
          <button
            onClick={onDismiss}
            disabled={!solved}
            className={cn(
              "flex-1 rounded-2xl py-4 text-base font-extrabold transition-all",
              solved
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
