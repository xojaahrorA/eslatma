"use client";

/**
 * ─── Budilnik dvigateli — mahalliy, oflayn, server yo'q (PRD 4.7) ───────────
 * Har bir budilnik uchun FAQAT keyingi occurrence Android'ning aniq
 * (exact) alarmini rejalashadi. Zang chalib bo'lgach (o'chirilmagan bo'lsa)
 * — ongoing bildirishnoma telefondan o'chmaydi, ilova ochilganda
 * to'liq ekranli zang oynasi ko'rinadi.
 *
 * Takrorlanish: bir marta jiringlagach (dismiss) syncAlarms() navbatdagi
 * kunni qayta rejalashadi — hech qanday server kerak emas.
 */

import { LocalNotifications } from "@capacitor/local-notifications";
import { parseLocal, isoLocal, pad2 } from "./utils-app";
import type { Alarm, PendingRing } from "./types";

const SCHED_KEY = "ulos-alarm-sched";

/** string id → Android int id (0..2^31-1) */
export function hashRingId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483000;
}

export const ringNotifId = (key: string) => hashRingId(key);

function loadSched(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SCHED_KEY) ?? "[]") as number[];
  } catch {
    return [];
  }
}
function saveSched(ids: number[]) {
  try {
    localStorage.setItem(SCHED_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** "HH:mm" + hafta kunlari → kelgusi mos vaqt (o'tganini tashlab) */
export function nextOccurrence(time: string, days: number[], from = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hh = Math.min(23, Number(m[1]));
  const mm = Math.min(59, Number(m[2]));
  for (let i = 0; i < 9; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= from.getTime()) continue;
    if (days.length === 0 || days.includes(d.getDay())) return d;
  }
  return null;
}

export function ringKey(kind: "alarm" | "task", id: string, at: Date): string {
  return `${kind}:${id}:${at.getTime()}`;
}

/** Bitta zang uchun aniq (exact) bildirishnoma — ovozli "alarm" kanali */
export async function scheduleRingNotif(ring: PendingRing): Promise<boolean> {
  const at = parseLocal(ring.at);
  if (!at || at.getTime() <= Date.now()) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ringNotifId(ring.key),
          title: ring.title,
          body: ring.body ?? "",
          smallIcon: "ic_stat_notify",
          channelId: "alarm",
          ongoing: true,
          schedule: { at, allowWhileIdle: true, exact: true },
        } as never,
      ],
    });
    return true;
  } catch {
    // exact ruxsat bo'lmasa — aniqsiz (kechikishi mumkin)
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: ringNotifId(ring.key),
            title: ring.title,
            body: ring.body ?? "",
            smallIcon: "ic_stat_notify",
            channelId: "alarm",
            ongoing: true,
            schedule: { at, allowWhileIdle: true, exact: false },
          } as never,
        ],
      });
      return true;
    } catch {
      // web'da service worker bo'lmasa — in-app watchdog baribir chaladi
      return false;
    }
  }
}

export async function cancelRingNotif(key: string): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ringNotifId(key) }] });
  } catch {
    /* ignore */
  }
}

/** Snooze bildirishnomasini qayta sinxronlashdan saqlash uchun ro'yxatga olish */
function trackSched(id: number) {
  const ids = loadSched();
  if (!ids.includes(id)) {
    ids.push(id);
    saveSched(ids);
  }
}

export function trackRingNotif(key: string) {
  trackSched(ringNotifId(key));
}

/**
 * Barcha budilniklarni qayta rejalash (idempotent).
 * - eski rejalangan budilnik bildirishnomalari bekor qilinadi
 * - har yoqiq budilnik uchun keyingi occurrence + zang yozuvi yaratiladi
 * - allaqachon chalinayotgan (o'tgan) zanglar SAQLANADI — ular hali
 *   foydalanuvchi tomonidan o'chirilmagan (o'chmaydigan signal)
 * - snooze (keyin eslatish) zanglari ham saqlanib, qayta rejalashadi
 * Natija: to'liq yangi pendingRings ro'yxati (store'ga yoziladi).
 */
export async function syncAlarms(alarms: Alarm[], existing: PendingRing[]): Promise<PendingRing[]> {
  const oldIds = loadSched();
  if (oldIds.length) {
    try {
      await LocalNotifications.cancel({
        notifications: oldIds.map((id) => ({ id })),
      });
    } catch {
      /* ignore */
    }
  }

  const now = Date.now();
  const atTs = (r: PendingRing) => parseLocal(r.at)?.getTime() ?? 0;

  // Hali o'chirilmagan o'tgan zanglar — faqat budilniklarga tegishlilari.
  // (Task zanglarini syncNotifs o'zi boshqaradi)
  const past = existing.filter(
    (r) => r.kind === "alarm" && atTs(r) <= now && !r.key.startsWith("snooze:")
  );
  const snoozed = existing.filter((r) => r.key.startsWith("snooze:") && atTs(r) > now);
  const sched: number[] = [];
  const rings: PendingRing[] = [...past];

  for (const r of snoozed) {
    const ok = await scheduleRingNotif(r);
    if (ok) sched.push(ringNotifId(r.key));
    rings.push(r);
  }

  for (const a of alarms) {
    if (!a.enabled) continue;
    const at = nextOccurrence(a.time, a.days);
    if (!at) continue;
    // o'sha budilnikning mavjud kelgusi zangi bo'lsa (vaqt o'zgarmagan) — saqlab qolamiz
    const same = existing.find(
      (r) =>
        r.kind === "alarm" &&
        r.alarmId === a.id &&
        !r.key.startsWith("snooze:") &&
        atTs(r) > now &&
        r.time === a.time
    );
    // Zang sozlamalari (missiyalar, qiyinlik, snooze) budilnikdan doim yangilanadi
    const fields = {
      challenge: a.challenge,
      missions: a.missions && a.missions.length ? a.missions : a.challenge ? ["math" as const] : [],
      difficulty: a.difficulty ?? ("medium" as const),
      smart: a.smart ?? false,
      snoozeLimit: a.snoozeLimit ?? null,
      snoozeMin: a.snoozeMin ?? 5,
    };
    const ring: PendingRing =
      same
        ? { ...same, ...fields }
        : {
        key: ringKey("alarm", a.id, at),
        kind: "alarm",
        alarmId: a.id,
        title: a.label?.trim() || a.time,
        body: `⏰ ${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
        at: isoLocal(at),
        ...fields,
        once: a.days.length === 0,
        days: a.days,
        time: a.time,
      };
    rings.push(ring);
    const ok = await scheduleRingNotif(ring);
    if (ok) sched.push(ringNotifId(ring.key));
  }

  saveSched(sched);
  return rings;
}
