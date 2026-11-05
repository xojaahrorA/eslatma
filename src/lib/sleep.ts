"use client";

/**
 * ─── Uyqu tahlil dvigateli — to'liq qurilmada hisoblanadi (PRD 4.7) ─────────
 * Ikki rejim:
 *  1) Sensor (akselerometr): har daqiqalik harakat indeksi 0..100 asosida
 *     bosqichlar (chuqur/yengil/REM/uyg'onish) aniqlanadi — sportchilardagi
 *     kabi harakatga asoslangan kuzatuv.
 *  2) Qo'lda: foydalanuvchi 2-3 tezkor savolga javob beradi — bosqichlar
 *     uyqu tibbiyotidagi o'rtacha ulushlar asosida taxminlanadi.
 *
 * Muhim: natijalar "taxminiy" — bu tibbiy tashxis emas (UI'da ham shunday
 * ko'rsatiladi). Barcha hisoblar mahalliy — hech qayerga jo'natilmaydi.
 */

import type { SleepSession, SleepStages } from "./types";
import { parseLocal } from "./utils-app";

export interface SleepAnalysis {
  totalMin: number; // yotoqda yotish (start..end)
  sleepMin: number; // sof uyqu (latency ayirilgan)
  stages: SleepStages; // daqiqalarda
  score: number; // 0..100
  cycles: number; // ≈90 daqiqalik tsikllar
  goalMin: number;
  latencyMin: number;
  awakeMin: number;
  sensor: boolean;
}

const CYCLE_MIN = 90;

/** Har daqiqalik harakatni silliq­lash (3 daqiqalik o'rtacha) */
function smooth(mv: number[]): number[] {
  return mv.map((_, i) => {
    const a = mv[Math.max(0, i - 1)];
    const b = mv[i];
    const c = mv[Math.min(mv.length - 1, i + 1)];
    return (a + b + c) / 3;
  });
}

export function analyzeSleep(session: SleepSession, goalH: number): SleepAnalysis | null {
  const s = parseLocal(session.start);
  const e = parseLocal(session.end);
  if (!s || !e || e.getTime() <= s.getTime()) return null;

  const totalMin = Math.round((e.getTime() - s.getTime()) / 60_000);
  const capped = Math.min(totalMin, 16 * 60); // 16 soatdan uzun sessiya — kesiladi
  const goalMin = Math.round(goalH * 60);

  // uxlashga ketgan vaqt (30% dan oshmaydi)
  const latencyMin = Math.max(0, Math.min(Math.round(session.latencyMin ?? 12), Math.round(capped * 0.3)));
  const sleepMin = Math.max(0, capped - latencyMin);

  const stages: SleepStages = { deep: 0, light: 0, rem: 0, awake: 0 };
  let sensor = false;

  if (session.motion && session.motion.length >= 10) {
    // ── 1) Sensor rejimi: harakat → bosqichlar ──
    sensor = true;
    const mv = smooth(session.motion.slice(0, capped));
    // birinchi latencyMin daqiqa — hali uxlamagan (yotib, ro'yxat ko'rgan)
    for (let i = latencyMin; i < mv.length; i++) {
      const m = mv[i];
      const elapsed = i - latencyMin;
      const phase = (elapsed % CYCLE_MIN) / CYCLE_MIN;
      if (m >= 42) stages.awake++;
      else if (phase > 0.72) {
        // tsikl oxiri — tinch harakat bo'lsa REM (tibbiy kuzatuv: REM tsikl oxirida)
        if (m < 14) stages.rem++;
        else stages.light++;
      } else if (m < 12) stages.deep++;
      else stages.light++;
    }
    // chuqur uyqu o'rtacha 13–23% — ortiqchasini yengilga o'tkazamiz
    const deepCap = Math.round(sleepMin * 0.28);
    if (stages.deep > deepCap) {
      stages.light += stages.deep - deepCap;
      stages.deep = deepCap;
    }
  } else {
    // ── 2) Qo'lda rejim: o'rtacha ulushlar (uyqu gidienesidagi taxminlar) ──
    const wakings = Math.max(0, Math.round(session.wakings ?? 0));
    stages.awake = Math.min(wakings * 8, Math.round(sleepMin * 0.12));
    const rest = sleepMin - stages.awake;
    // chuqur tunning birinchi yarmida, REM ikkinchi yarmida ko'p — jami foizlar:
    stages.deep = Math.round(rest * 0.2);
    stages.rem = Math.round(rest * 0.22);
    stages.light = rest - stages.deep - stages.rem;
  }

  // ─── Ball (0..100) ───
  const durPart = 50 * Math.min(1, sleepMin / Math.max(1, goalMin));
  const restorative = stages.deep + stages.rem;
  const share = sleepMin > 0 ? restorative / sleepMin : 0;
  const stagePart = 25 * Math.min(1, share / 0.42);
  const qPart =
    session.quality != null ? 15 * Math.min(1, Math.max(0, session.quality - 1) / 4) : 10;
  const latPart = latencyMin <= 10 ? 10 : latencyMin <= 20 ? 7 : latencyMin <= 30 ? 4 : 2;
  const score = Math.round(durPart + stagePart + qPart + latPart);

  return {
    totalMin: capped,
    sleepMin,
    stages,
    score: Math.max(0, Math.min(100, score)),
    cycles: Math.round((sleepMin / CYCLE_MIN) * 10) / 10,
    goalMin,
    latencyMin,
    awakeMin: stages.awake,
    sensor,
  };
}

// ─── Haftalik statistika ─────────────────────────────────────────────────────

export interface DaySleep {
  date: string; // yyyy-MM-dd (uygonilgan kun)
  sleepMin: number;
  score: number | null;
  sessions: number;
}

/** Sessiyalarni UYG'ONILGAN kunga joylashtirib, oxirgi n kun qatorini chiqaradi */
export function weeklySeries(sessions: SleepSession[], days: number): DaySleep[] {
  const map = new Map<string, DaySleep>();
  for (const sess of sessions) {
    const e = parseLocal(sess.end);
    if (!e) continue;
    const key = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
    const a = sess.score;
    const cur = map.get(key) ?? { date: key, sleepMin: 0, score: null, sessions: 0 };
    const s = parseLocal(sess.start);
    const total = s ? Math.min(16 * 60, Math.round((e.getTime() - s.getTime()) / 60_000)) : 0;
    cur.sleepMin += total;
    cur.sessions += 1;
    if (a != null) cur.score = cur.score == null ? a : Math.round((cur.score + a) / 2);
    map.set(key, cur);
  }
  const out: DaySleep[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push(map.get(key) ?? { date: key, sleepMin: 0, score: null, sessions: 0 });
  }
  return out;
}

/** So'nggi 7 kun uyqu qarzi (maqsadga yetmagan daqiqalar, faqat manfiy).
 *  Faqat KUZATUV BO'LGAN kunlar hisoblanadi — ma'lumot yo'q kunlar jazolmaydi. */
export function sleepDebt(series: DaySleep[], goalMin: number): number {
  return series.reduce(
    (acc, d) => (d.sessions > 0 ? acc + Math.max(0, goalMin - d.sleepMin) : acc),
    0
  );
}

/** Muntazamlik %: yotish vaqti farqi kichik bo'lsa — yuqori */
export function consistencyScore(sessions: SleepSession[]): number | null {
  const mids: number[] = [];
  for (const s of sessions.slice(-14)) {
    const st = parseLocal(s.start);
    if (!st) continue;
    // yotish vaqti: 18:00 dan keyin yoki 06:00 gacha (tunga nisbatan burchak)
    let min = st.getHours() * 60 + st.getMinutes();
    if (min < 12 * 60) min += 24 * 60; // tungi 00-06 ni kechki tomonga suring
    if (min >= 18 * 60) mids.push(min);
  }
  if (mids.length < 3) return null;
  const avg = mids.reduce((a, b) => a + b, 0) / mids.length;
  const sd = Math.sqrt(mids.reduce((a, b) => a + (b - avg) ** 2, 0) / mids.length);
  return Math.max(0, Math.round(100 - (sd / 90) * 100));
}

export function fmtHM(min: number, hWord: string, mWord: string, sep: string): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0 && m > 0) return `${h}${hWord}${sep}${m}${mWord}`;
  if (h > 0) return `${h}${hWord}`;
  return `${m}${mWord}`;
}
