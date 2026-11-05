"use client";

/**
 * ─── Uyqu aqili tahlil dvigateli (v1.9) ─────────────────────────────────────
 * Maqsad: budilnik ↔ uyqu ↔ vazifalarni BIR tizimga bog'lash.
 *
 * 1) Kunlik parchalar: bir kunda necha marta yotish (4 s, 3 s, tushlik
 *    uyqusi…) — har biri alohida segment sifatida hisoblanadi va jamlanadi.
 * 2) Yotish odatlari: "qaysi paytlarda yotgani" — o'rtacha yotish vaqti,
 *    og'ish, uyg'onish vaqti, ish kuni ↔ dam olish kunlari farqi (social
 *    jetlag), tushlik uyqusi statistikasi.
 * 3) Tavsiyalar (o'zi taklif qiladi): uyqu qarzi, yotish vaqti surinishi,
 *    snooze odati — har biri "Qo'llash" tugmasi bilan avtomatik sozlanadi.
 * 4) Uyqu ↔ vazifalar bog'liqligi: uyqu yetarli bo'lgan kunlarda bajarilgan
 *    ishlar solishtiriladi (analitika bo'limi uchun).
 *
 * Barcha hisoblar mahalliy — hech qayerga jo'natilmaydi.
 */

import type { Alarm, AlarmStat, Settings, SleepSession, Task } from "./types";
import { dateKey, parseLocal, pad2 } from "./utils-app";

// ─── Sessiya tasnifi: tun uyqusi yoki qisqa dam olish ────────────────────────

export type SleepKind = "night" | "nap";

export function sessionKind(s: SleepSession): SleepKind {
  const st = parseLocal(s.start);
  const en = parseLocal(s.end);
  if (!st || !en) return "night";
  const min = Math.max(0, Math.round((en.getTime() - st.getTime()) / 60_000));
  if (min >= 210) return "night"; // ≥ 3.5 soat — to'liq uyqu
  // kechqurun/tungi qisqa yotish ham "tun" hisoblanadi
  const h = st.getHours();
  if (h >= 21 || h < 4) return "night";
  return "nap";
}

export function sessionMinutes(s: SleepSession): number {
  const st = parseLocal(s.start);
  const en = parseLocal(s.end);
  if (!st || !en) return 0;
  return Math.max(0, Math.min(16 * 60, Math.round((en.getTime() - st.getTime()) / 60_000)));
}

// ─── 1) Kunlik parchalar ─────────────────────────────────────────────────────

export interface DaySegment {
  start: string; // "HH:mm"
  end: string;
  min: number;
  kind: SleepKind;
}

export interface DaySegments {
  date: string; // yyyy-MM-dd (uyg'onilgan kun)
  segs: DaySegment[];
  totalMin: number;
  nightMin: number;
  napMin: number;
  goalHit: boolean;
}

/**
 * Oxirgi n kun: har kun uchun yotish parchalari (masalan: 23:10→02:30 +
 * 14:00→15:30). Sessiya UYG'ONILGAN kunga tegishli — kechagi tun bugunda
 * tugagani uchun bugunga yoziladi (mission: "bir kundagi barcha joylar").
 */
export function daySegments(sessions: SleepSession[], days: number): DaySegments[] {
  const map = new Map<string, DaySegments>();
  for (const s of sessions) {
    const st = parseLocal(s.start);
    const en = parseLocal(s.end);
    if (!st || !en || en.getTime() <= st.getTime()) continue;
    const key = dateKey(en);
    const cur =
      map.get(key) ??
      ({ date: key, segs: [], totalMin: 0, nightMin: 0, napMin: 0, goalHit: false } as DaySegments);
    const min = Math.min(16 * 60, Math.round((en.getTime() - st.getTime()) / 60_000));
    const kind = sessionKind(s);
    cur.segs.push({
      start: `${pad2(st.getHours())}:${pad2(st.getMinutes())}`,
      end: `${pad2(en.getHours())}:${pad2(en.getMinutes())}`,
      min,
      kind,
    });
    cur.totalMin += min;
    if (kind === "night") cur.nightMin += min;
    else cur.napMin += min;
    map.set(key, cur);
  }
  const out: DaySegments[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const row = map.get(dateKey(d));
    if (row) {
      row.segs.sort((a, b) => a.start.localeCompare(b.start));
      out.push(row);
    } else {
      out.push({ date: dateKey(d), segs: [], totalMin: 0, nightMin: 0, napMin: 0, goalHit: false });
    }
  }
  return out;
}

// ─── 2) Yotish odatlari ──────────────────────────────────────────────────────

export interface BedtimePattern {
  /** Ma'lumot yetarlimi (kamida 3 ta tun) */
  ok: boolean;
  nights: number;
  /** O'rtacha yotish vaqti "HH:mm" (tunga nisbatan aylantirilgan o'rtacha) */
  avgBed: string;
  /** Yotish vaqtining og'ishi (daq) — kichik = muntazam */
  bedSd: number;
  /** O'rtacha uyg'onish vaqti "HH:mm" */
  avgWake: string;
  /** O'rtacha tun davomiyligi (daq) */
  avgNightMin: number;
  /** Ish kuni ↔ dam olish farqi (daq) — musbat: dam olishda kechroq yotadi */
  jetlagMin: number | null;
  /** Tushlik uyqusi (7 kun): soni va jami daqiqasi */
  naps7: number;
  napMin7: number;
  /** Eng erta / eng kech yotish (last 14 tun) "HH:mm" */
  earliest: string;
  latest: string;
}

/** Yotish vaqtini tunga nisbatan burchakka keltirish: 18:00+ → 18..42 soat */
function bedAngleMin(d: Date): number {
  let m = d.getHours() * 60 + d.getMinutes();
  if (m < 12 * 60) m += 24 * 60; // tungi 00:00–06:00 → kechki tomon
  return m;
}
function fmtAngle(m: number): string {
  const h = Math.floor((m % (24 * 60)) / 60);
  const mm = Math.round(m % 60);
  return `${pad2(h)}:${pad2(mm)}`;
}

export function bedtimePattern(sessions: SleepSession[], wakeDayMin = 0): BedtimePattern {
  const night = sessions
    .filter((s) => sessionKind(s) === "night")
    .sort((a, b) => (parseLocal(b.start)?.getTime() ?? 0) - (parseLocal(a.start)?.getTime() ?? 0))
    .slice(0, 14);

  const beds: number[] = [];
  const wakes: number[] = [];
  const durs: number[] = [];
  const wd: number[] = []; // ish kuni yotishlari
  const we: number[] = []; // dam olish yotishlari
  for (const s of night) {
    const st = parseLocal(s.start);
    const en = parseLocal(s.end);
    if (!st || !en) continue;
    const b = bedAngleMin(st);
    beds.push(b);
    wakes.push(en.getHours() * 60 + en.getMinutes());
    durs.push(Math.min(16 * 60, Math.round((en.getTime() - st.getTime()) / 60_000)));
    const dow = st.getDay();
    if (dow === 0 || dow === 6) we.push(b);
    else wd.push(b);
  }

  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const sd = (a: number[]) => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((acc, v) => acc + (v - m) ** 2, 0) / a.length);
  };

  // tushlik uyqusi — so'nggi 7 kun
  const cutoff = Date.now() - 7 * 86_400_000;
  const naps = sessions.filter((s) => {
    const en = parseLocal(s.end);
    return en && en.getTime() >= cutoff && sessionKind(s) === "nap";
  });

  const avgBedRaw = mean(beds);
  const jet = wd.length >= 2 && we.length >= 2 ? Math.round(mean(we) - mean(wd)) : null;

  return {
    ok: beds.length >= 3,
    nights: beds.length,
    avgBed: fmtAngle(avgBedRaw),
    bedSd: Math.round(sd(beds)),
    avgWake: fmtAngle(mean(wakes)),
    avgNightMin: Math.round(mean(durs)),
    jetlagMin: jet,
    naps7: naps.length,
    napMin7: naps.reduce((a, s) => a + sessionMinutes(s), 0),
    earliest: fmtAngle(beds.length ? Math.min(...beds) : 0),
    latest: fmtAngle(beds.length ? Math.max(...beds) : 0),
  };
}

// ─── 3) Aqili tavsiyalar — o'zi taklif qiladi, 1 bosishda qo'llanadi ────────

export type AdviceAction =
  | { kind: "setBedtime"; value: string }
  | { kind: "setWindMin"; value: number }
  | { kind: "setGoal"; value: number }
  | { kind: "shiftAlarm"; alarmId: string; value: string }
  | { kind: "openSleep" };

export interface SleepAdvice {
  key: string; // i18n kalit prefiksi
  vars: Record<string, string | number>;
  tone: "good" | "warn" | "info";
  action?: AdviceAction;
  actionKey?: string; // i18n: tugma matni
}

/**
 * Uyqu + budilnik + sozlamalar ma'lumotidan cross-modul tavsiyalar.
 * Har bir tavsiyada aniq harakat bor — "o'zi qo'shib qo'yish" uchun.
 */
export function sleepAdvice(
  sessions: SleepSession[],
  alarms: Alarm[],
  alarmStats: Record<string, AlarmStat>,
  settings: Settings
): SleepAdvice[] {
  const out: SleepAdvice[] = [];
  const goalH = settings.sleepGoalH ?? 8;
  const goalMin = goalH * 60;

  // 7 kunlik qarz
  const cutoff = Date.now() - 7 * 86_400_000;
  const recent = sessions.filter((s) => (parseLocal(s.end)?.getTime() ?? 0) >= cutoff);
  const debtMin = recent.reduce((a, s) => {
    const got = sessionMinutes(s);
    return a + Math.max(0, goalMin - got);
  }, 0);
  const night7 = recent.filter((s) => sessionKind(s) === "night");
  const avgLat =
    night7.length > 0
      ? Math.round(night7.reduce((a, s) => a + Math.max(0, Math.min(s.latencyMin ?? 12, 60)), 0) / night7.length)
      : 12;
  const avgNight =
    night7.length > 0
      ? Math.round(night7.reduce((a, s) => a + sessionMinutes(s), 0) / night7.length)
      : 0;

  const mainAlarm = [...alarms]
    .filter((a) => a.enabled)
    .sort((a, b) => a.time.localeCompare(b.time))[0];

  // 1) Uyqu qarzi katta → yotish vaqtini qayta hisoblab, o'zi qo'yadi
  //    Budilnik bo'lmasa — o'lchangan o'rtacha uyg'onish vaqtidan hisoblanadi
  if (debtMin >= 240) {
    let wakeMin: number | null = null;
    if (mainAlarm) {
      const [h, m] = mainAlarm.time.split(":").map(Number);
      wakeMin = h * 60 + m;
    } else {
      const ends = night7
        .map((s) => parseLocal(s.end))
        .filter((d): d is Date => !!d)
        .slice(-7);
      if (ends.length >= 2) {
        wakeMin = Math.round(
          ends.reduce((a, d) => a + d.getHours() * 60 + d.getMinutes(), 0) / ends.length
        );
      }
    }
    if (wakeMin != null) {
      const total = wakeMin - goalMin - avgLat;
      const bt = `${pad2((((Math.floor(total / 60) % 24) + 24) % 24))}:${pad2(((total % 60) + 60) % 60)}`;
      out.push({
        key: "sad.debt",
        vars: { d: debtMin, dh: Math.floor(debtMin / 60), dm: debtMin % 60, t: bt },
        tone: "warn",
        action: { kind: "setBedtime", value: bt },
        actionKey: "sad.applyBed",
      });
    }
  }

  // 2) O'lchangan yotish vaqti sozlamadagidan farq qilsa → yangilash
  const pat = bedtimePattern(sessions);
  if (pat.ok && settings.sleepBedtime) {
    const set = bedAngleMinStr(settings.sleepBedtime);
    const real = bedAngleMinStr(pat.avgBed);
    if (Math.abs(real - set) >= 45) {
      out.push({
        key: "sad.drift",
        vars: { real: pat.avgBed, set: settings.sleepBedtime },
        tone: "info",
        action: { kind: "setBedtime", value: pat.avgBed },
        actionKey: "sad.applyBed",
      });
    }
  }

  // 3) Snooze odati → budilnikni o'z vaqtiga moslash
  const snoozeAlarmId = Object.entries(alarmStats).find(
    ([, st]) => st.last === "snooze" && st.snoozes >= 2
  )?.[0];
  const snoozeAlarm = alarms.find((a) => a.id === snoozeAlarmId && a.enabled);
  if (snoozeAlarm && avgNight > 0 && avgNight < goalMin - 30) {
    // budilnikdan 30 dq ertaroq yotish taklifi — yotish eslatmasi orqali
    const [h, m] = snoozeAlarm.time.split(":").map(Number);
    const total = h * 60 + m - goalMin - avgLat;
    const bt = `${pad2((((Math.floor(total / 60) % 24) + 24) % 24))}:${pad2(((total % 60) + 60) % 60)}`;
    out.push({
      key: "sad.snooze",
      vars: { t: snoozeAlarm.time, d: goalMin - avgNight },
      tone: "warn",
      action: { kind: "setBedtime", value: bt },
      actionKey: "sad.applyBed",
    });
  }

  // 4) Uxlashga qiyinlik → tayyorgarlik davrini uzaytirish
  if (avgLat >= 25 && (settings.sleepWindMin ?? 30) < 45) {
    out.push({
      key: "sad.latency",
      vars: { d: avgLat },
      tone: "info",
      action: { kind: "setWindMin", value: 45 },
      actionKey: "sad.applyWind",
    });
  }

  // 5) Tushlik uyqulari ko'p → tungi uyqu yetarli emas
  if (pat.naps7 >= 5 && pat.napMin7 >= 240) {
    out.push({
      key: "sad.naps",
      vars: { n: pat.naps7, m: pat.napMin7 },
      tone: "info",
      action: { kind: "openSleep" },
      actionKey: "sad.applyLook",
    });
  }

  // 6) Dam olish ↔ ish kuni farqi katta
  if (pat.jetlagMin != null && Math.abs(pat.jetlagMin) >= 75) {
    out.push({
      key: "sad.jetlag",
      vars: { d: Math.abs(pat.jetlagMin) },
      tone: "info",
    });
  }

  // 7) Zo'r holat — ijobiy xabar
  if (night7.length >= 4 && debtMin < 60 && avgNight >= goalMin) {
    out.push({
      key: "sad.good",
      vars: { h: Math.floor(avgNight / 60), m: avgNight % 60 },
      tone: "good",
    });
  }

  return out.slice(0, 4);
}

function bedAngleMinStr(t: string): number {
  const [h, m] = t.split(":").map(Number);
  let v = h * 60 + m;
  if (v < 12 * 60) v += 24 * 60;
  return v;
}

// ─── 4) Uyqu ↔ vazifalar bog'liqligi ────────────────────────────────────────

export interface TaskSleepLink {
  ok: boolean;
  /** Uyqu yetarli kunlar: o'rtacha bajarilgan vazifa */
  goodDone: number;
  /** Uyqu yetarli emas kunlar */
  badDone: number;
  goodDays: number;
  badDays: number;
  /** goodDone / max(1, badDone) */
  ratio: number;
}

/** Uyqu maqsadga yetgan kunlar bilan yetmagan kunlarda bajarilgan ish solishtiriladi */
export function sleepTaskLink(
  sessions: SleepSession[],
  tasks: Task[],
  goalMin: number,
  days = 14
): TaskSleepLink {
  const doneByDay = new Map<string, number>();
  for (const tk of tasks) {
    if (tk.status === "done" && tk.completedAt) {
      const k = tk.completedAt.slice(0, 10);
      doneByDay.set(k, (doneByDay.get(k) ?? 0) + 1);
    }
  }
  // kunlar: uygonilgan kun bo'yicha jamlash
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const en = parseLocal(s.end);
    if (!en) continue;
    const k = dateKey(en);
    byDay.set(k, (byDay.get(k) ?? 0) + sessionMinutes(s));
  }
  let goodDone = 0;
  let badDone = 0;
  let goodDays = 0;
  let badDays = 0;
  const today = new Date();
  for (let i = days - 1; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    const got = byDay.get(k);
    if (got == null || got < 180) continue; // kuzatuv bo'lmagan kunlar o'tkaziladi
    const done = doneByDay.get(k) ?? 0;
    if (got >= goalMin) {
      goodDays++;
      goodDone += done;
    } else {
      badDays++;
      badDone += done;
    }
  }
  if (goodDays === 0 || badDays === 0) {
    return { ok: false, goodDone, badDone, goodDays, badDays, ratio: 0 };
  }
  const ratio = goodDone / Math.max(1, badDone);
  return { ok: ratio >= 1.4 && goodDone >= 3, goodDone, badDone, goodDays, badDays, ratio };
}
