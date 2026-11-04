"use client";

/**
 * ─── Budilnik missiyalari dvigateli — Mission Alarm uslubi (v1.8) ───────────
 * 5 xil missiya: math (matematika), memory (xotira), typing (yozish),
 * shake (silkitish), motion (qadamlar). Missiyalar ketma-ket (zanjir)
 * bajariladi — barchasi tugagach zangni to'xtatish mumkin.
 *
 * Sensor missiyalari (shake/motion) DeviceMotionEvent orqali ishlaydi.
 * Sensor javob bermasa (web/desktop yoki ruxsat yo'q) — 2.5 sekunddan
 * keyin zaxira "bosish" tugmasi chiqadi (halol rejim: hech qanday holatda
 * foydalanuvchi tizilib qolmaydi).
 */

import { useEffect, useRef, useState } from "react";
import { Calculator, Brain, Keyboard, Vibrate, Footprints, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissionDifficulty, MissionType } from "@/lib/types";

type TFn = (k: string, v?: Record<string, string | number>) => string;

/** Missiya belgilari va nom kalitlari — muharrir ham, zang oynasi ham shuni ishlatadi */
export const MISSION_META: Record<MissionType, { icon: LucideIcon; key: string }> = {
  math: { icon: Calculator, key: "mission.math" },
  memory: { icon: Brain, key: "mission.memory" },
  typing: { icon: Keyboard, key: "mission.typing" },
  shake: { icon: Vibrate, key: "mission.shake" },
  motion: { icon: Footprints, key: "mission.motion" },
};

/** Aqili rejim: missiya tartibini har zangda aralashtirish (mushak xotirasiga qarshi) */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/** onPass faqat bir marta chaqirilishi kafolatlanadi */
function useOncePass(onPass: () => void) {
  const done = useRef(false);
  return () => {
    if (done.current) return;
    done.current = true;
    onPass();
  };
}

// ─── 1. Matematika ───────────────────────────────────────────────────────────

function makeMath(d: MissionDifficulty): { text: string; ans: number } {
  if (d === "easy") {
    const a = rnd(11, 49);
    const b = rnd(11, 49);
    return { text: `${a} + ${b}`, ans: a + b };
  }
  if (d === "medium") {
    const a = rnd(6, 12);
    const b = rnd(6, 12);
    const c = rnd(21, 88);
    return { text: `${a} × ${b} + ${c}`, ans: a * b + c };
  }
  const a = rnd(7, 15);
  const b = rnd(7, 15);
  const c = rnd(3, 9);
  const e = rnd(20, 99);
  return { text: `(${a} + ${b}) × ${c} − ${e}`, ans: (a + b) * c - e };
}

function MathMission({ difficulty, t, onPass }: { difficulty: MissionDifficulty; t: TFn; onPass: () => void }) {
  const [q, setQ] = useState(() => makeMath(difficulty));
  const [val, setVal] = useState("");
  const [wrong, setWrong] = useState(false);
  const pass = useOncePass(onPass);

  const check = () => {
    if (Number(val.trim()) === q.ans) {
      pass();
    } else {
      setWrong(true);
      setVal("");
      setTimeout(() => {
        setWrong(false);
        setQ(makeMath(difficulty));
      }, 700);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-white/70">{t("ring.challengeTitle")}</p>
      <p className="text-center text-[30px] font-extrabold tabular-nums text-white">{q.text} = ?</p>
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
        <button onClick={check} className="rounded-2xl bg-white/10 px-5 text-sm font-bold text-white transition-colors hover:bg-white/20">
          {t("ring.check")}
        </button>
      </div>
      {wrong && <p className="mt-2 text-center text-xs font-semibold text-rose-400">{t("ring.wrong")}</p>}
    </div>
  );
}

// ─── 2. Xotira (ketma-ketlik) ────────────────────────────────────────────────

const MEM_TILES = ["🍎", "🌟", "🔷", "🍇", "⚡", "🍀", "🔥", "🌙"];

function MemoryMission({ difficulty, t, onPass }: { difficulty: MissionDifficulty; t: TFn; onPass: () => void }) {
  const len = difficulty === "easy" ? 4 : difficulty === "medium" ? 5 : 7;
  const [seq, setSeq] = useState<number[]>(() => Array.from({ length: len }, () => rnd(0, MEM_TILES.length - 1)));
  const [phase, setPhase] = useState<"show" | "input">("show");
  const [hi, setHi] = useState(-1);
  const [input, setInput] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);
  const pass = useOncePass(onPass);

  // ko'rsatish fazasi — har belgi 650ms yonadi
  useEffect(() => {
    if (phase !== "show") return;
    let cancelled = false;
    const timers: number[] = [];
    seq.forEach((_, i) => {
      timers.push(window.setTimeout(() => !cancelled && setHi(i), i * 650));
    });
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setHi(-1);
        setPhase("input");
      }, seq.length * 650 + 350)
    );
    return () => {
      cancelled = true;
      timers.forEach((x) => window.clearTimeout(x));
    };
  }, [seq, phase]);

  const tap = (i: number) => {
    if (phase !== "input" || wrong) return;
    if (seq[input.length] === i) {
      const next = [...input, i];
      setInput(next);
      if (next.length === seq.length) pass();
    } else {
      setWrong(true);
      window.setTimeout(() => {
        setWrong(false);
        setInput([]);
        setSeq(Array.from({ length: len }, () => rnd(0, MEM_TILES.length - 1)));
        setPhase("show");
      }, 900);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-white/70">
        {phase === "show" ? t("mission.memoryWatch") : t("mission.memoryRepeat")}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {MEM_TILES.map((em, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            disabled={phase === "show"}
            className={cn(
              "flex h-[52px] items-center justify-center rounded-2xl text-2xl transition-all",
              phase === "show" && i === hi
                ? "scale-105 bg-rose-500/30 ring-2 ring-rose-400"
                : "bg-white/[0.06]",
              phase === "input" && "active:scale-95 hover:bg-white/10"
            )}
          >
            {em}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {seq.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-5 rounded-full transition-colors",
              i < input.length ? "bg-emerald-400" : "bg-white/15",
              wrong && "bg-rose-500"
            )}
          />
        ))}
      </div>
      {wrong && <p className="mt-2 text-center text-xs font-semibold text-rose-400">{t("mission.memoryWrong")}</p>}
    </div>
  );
}

// ─── 3. Yozish ───────────────────────────────────────────────────────────────

const normText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[«»"“”„‟']/g, '"')
    .replace(/\s+/g, " ")
    .trim();

function TypingMission({ difficulty, t, onPass }: { difficulty: MissionDifficulty; t: TFn; onPass: () => void }) {
  const pool = difficulty === "easy" ? [1, 2] : difficulty === "medium" ? [2, 3] : [3, 4];
  const n = pool[rnd(0, pool.length - 1)];
  const phrase = t(`mission.phrase${n}`);
  const [val, setVal] = useState("");
  const pass = useOncePass(onPass);
  const ok = normText(val) === normText(phrase);

  useEffect(() => {
    if (ok) pass();
  }, [ok, pass]);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-white/70">{t("mission.typePrompt")}</p>
      <div className="mb-3 rounded-2xl bg-black/30 px-4 py-3">
        <p className="text-center text-[15px] font-bold leading-snug text-white">{phrase}</p>
      </div>
      <textarea
        autoFocus
        rows={2}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={t("mission.typePh")}
        className={cn(
          "w-full resize-none rounded-2xl bg-black/30 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30",
          ok && "ring-2 ring-emerald-500",
          !ok && val.length > 0 && "ring-1 ring-white/10"
        )}
      />
    </div>
  );
}

// ─── 4/5. Sensor: silkitish (shake) va qadamlar (motion) ─────────────────────

function SensorMission({
  mode,
  difficulty,
  t,
  onPass,
}: {
  mode: "shake" | "motion";
  difficulty: MissionDifficulty;
  t: TFn;
  onPass: () => void;
}) {
  const target =
    mode === "shake"
      ? difficulty === "easy"
        ? 8
        : difficulty === "medium"
          ? 15
          : 25
      : difficulty === "easy"
        ? 10
        : difficulty === "medium"
          ? 20
          : 35;
  const [count, setCount] = useState(0);
  const [sensorOk, setSensorOk] = useState<boolean | null>(null);
  const pass = useOncePass(onPass);
  const lastPeak = useRef(0);
  const countRef = useRef(0);

  const bump = () => {
    countRef.current += 1;
    setCount(countRef.current);
  };

  useEffect(() => {
    if (!("DeviceMotionEvent" in window)) {
      setSensorOk(false);
      return;
    }
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const delta = Math.abs(mag - 9.81);
      const thr = mode === "shake" ? 4.2 : 2.1;
      const gap = mode === "shake" ? 320 : 260;
      const now = Date.now();
      if (delta > thr && now - lastPeak.current > gap) {
        lastPeak.current = now;
        setSensorOk(true);
        bump();
      }
    };
    window.addEventListener("devicemotion", handler);
    const to = window.setTimeout(() => {
      setSensorOk((s) => (s === true ? true : false));
    }, 2500);
    return () => {
      window.removeEventListener("devicemotion", handler);
      window.clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (count >= target) pass();
  }, [count, target, pass]);

  const pct = Math.min(100, Math.round((count / target) * 100));

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-white/70">
        {mode === "shake" ? t("mission.shakePrompt", { n: target }) : t("mission.motionPrompt", { n: target })}
      </p>
      <p className="mb-2 text-center text-[44px] font-extrabold leading-none tabular-nums text-white">
        {Math.min(count, target)}
        <span className="text-lg font-bold text-white/40">/{target}</span>
      </p>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {sensorOk === false && (
        <button
          onClick={bump}
          className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white/85 transition-colors hover:bg-white/20"
        >
          {t("mission.tapFallback", { n: target })}
        </button>
      )}
    </div>
  );
}

// ─── Zanjir dvigateli ────────────────────────────────────────────────────────

export function MissionRunner({
  missions,
  difficulty,
  t,
  onAllPass,
}: {
  missions: MissionType[];
  difficulty: MissionDifficulty;
  t: TFn;
  onAllPass: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const pass = () => {
    if (idx + 1 >= missions.length) onAllPass();
    else setIdx(idx + 1);
  };
  const current = missions[Math.min(idx, missions.length - 1)];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      {missions.length > 1 && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold text-white/70">{t("mission.progress", { n: idx + 1, total: missions.length })}</p>
          <span className="flex gap-1">
            {missions.map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 w-5 rounded-full transition-colors", i < idx ? "bg-emerald-400" : i === idx ? "bg-rose-400" : "bg-white/15")}
              />
            ))}
          </span>
        </div>
      )}
      {current === "math" && <MathMission difficulty={difficulty} t={t} onPass={pass} />}
      {current === "memory" && <MemoryMission difficulty={difficulty} t={t} onPass={pass} />}
      {current === "typing" && <TypingMission difficulty={difficulty} t={t} onPass={pass} />}
      {current === "shake" && <SensorMission mode="shake" difficulty={difficulty} t={t} onPass={pass} />}
      {current === "motion" && <SensorMission mode="motion" difficulty={difficulty} t={t} onPass={pass} />}
    </div>
  );
}
