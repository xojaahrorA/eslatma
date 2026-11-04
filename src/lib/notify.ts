"use client";

/**
 * ─── Bildirishnomalar — lokal eslatmalar (PRD 4.6.4 bilan moslashuvchan) ─────
 * APK'da: Android Local Notifications — ilova yopiq turganda ham keladi.
 * Saytda: brauzer Notification API — ilova ochiq turganda ishlaydi.
 * Hech qanday server yo'q: barcha eslatmalar faqat qurilmada rejalashadi.
 *
 * Mantiq: har sinxronlashda ESKI rejani tozalab, YANGISINI yozamiz
 * (idempotent — ikki marta chaqirilsa ham dublikat bo'lmaydi).
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isoLocal, parseLocal } from "./utils-app";
import { ringKey, ringNotifId } from "./alarm";
import type { PendingRing, Settings, Task } from "./types";

export const inApkEnv = () =>
  typeof window !== "undefined" && "Capacitor" in window && Capacitor.isNativePlatform();

/** string id → Android int id (0..2^31-1, to'qnashuv ehtimoli past) */
export function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483000;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** eslatma matnlari — tilga bog'liq (page'dan t() bilan beriladi) */
export interface NotifLabels {
  habitTitle: string;
  habitBody: string;
  morningTitle: string;
  morningBody: string;
  /** yotish eslatmasi (uyqu moduli) */
  bedtimeTitle?: string;
  bedtimeBody?: string;
}

// ─── Ruxsat ──────────────────────────────────────────────────────────────────

export type NotifPerm = "granted" | "denied" | "prompt";

export async function notifPermission(): Promise<NotifPerm> {
  try {
    const r = await LocalNotifications.checkPermissions();
    return (r.display as NotifPerm) ?? "prompt";
  } catch {
    return "denied";
  }
}

/** Ruxsat so'rash — faqat foydalanuvchi harakati (tugma/switch) bilan chaqiriladi */
export async function notifAsk(): Promise<boolean> {
  try {
    const r = await LocalNotifications.requestPermissions();
    return r.display === "granted";
  } catch {
    return false;
  }
}

// ─── Kanal (Android 8+) ──────────────────────────────────────────────────────

async function ensureChannel(): Promise<void> {
  if (!inApkEnv()) return;
  try {
    await LocalNotifications.createChannel({
      id: "reminders",
      name: "Eslatmalar",
      importance: 4, // HIGH
      visibility: 0, // PUBLIC
      vibration: true,
    } as never);
  } catch {
    /* web'da yoki allaqachon yaratilgan */
  }
  try {
    // Budilnik kanali: maxsus ovoz (res/raw/alarm_tone.wav) + kuchli tebranish
    await LocalNotifications.createChannel({
      id: "alarm",
      name: "Budilnik",
      importance: 4, // HIGH
      visibility: 0,
      vibration: true,
      sound: "alarm_tone.wav",
    } as never);
  } catch {
    /* ignore */
  }
}

// ─── Rejalash ────────────────────────────────────────────────────────────────

/** "HH:mm" → kelgusi mos vaqt (o'tgan bo'lsa ertaga) */
function nextDaily(hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const d = new Date();
  d.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

const OPEN_STATUSES = new Set(["todo", "in_progress", "deferred"]);
const MAX_TASK_NOTIFS = 40;

export interface NotifSyncResult {
  granted: boolean;
  scheduled: number;
  /** "budilnik kabi" vazifa zanglari — page ularni pendingRings'ga qo'shadi */
  taskRings: PendingRing[];
}

export async function clearNotifs(keepIds?: Set<number>): Promise<void> {
  try {
    const pend = await LocalNotifications.getPending();
    const kill = pend.notifications.filter((n) => !keepIds?.has(Number(n.id)));
    if (kill.length) {
      await LocalNotifications.cancel({
        notifications: kill.map((n) => ({ id: n.id })),
      });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Barcha eslatmalarni qayta rejalash. Ilova ochilganda, vazifa
 * o'zgartirilganda va sozlamalar o'zgarganda chaqiriladi.
 */
export async function syncNotifs(
  tasks: Task[],
  settings: Settings,
  labels: NotifLabels,
  keepIds?: Set<number>
): Promise<NotifSyncResult> {
  const alarmLikeTasks = tasks.filter(
    (t) => t.alarmLike && OPEN_STATUSES.has(t.status) && t.dueAt && t.hasTime
  );
  const anyOn = !!(
    settings.notifTasks ||
    settings.notifHabitTime ||
    settings.notifMorningTime ||
    settings.sleepBedtime ||
    alarmLikeTasks.length
  );
  if (!anyOn) {
    await clearNotifs(keepIds);
    return { granted: false, scheduled: 0, taskRings: [] };
  }

  let granted = false;
  try {
    granted = (await LocalNotifications.checkPermissions()).display === "granted";
  } catch {
    granted = false;
  }
  if (!granted) return { granted: false, scheduled: 0, taskRings: [] };

  await ensureChannel();
  await clearNotifs(keepIds);

  const now = Date.now();
  type Item = {
    id: number;
    title: string;
    body: string;
    at: Date;
    daily?: boolean;
    channel?: string;
    ongoing?: boolean;
  };
  const items: Item[] = [];
  const taskRings: PendingRing[] = [];

  // 1) Vazifa eslatmalari — vaqti belgilangan, ochiq vazifalar
  if (settings.notifTasks) {
    const before = settings.notifBeforeMin ?? 15;
    const upcoming = tasks
      .filter((t) => OPEN_STATUSES.has(t.status) && t.dueAt && t.hasTime)
      .map((t) => ({ t, due: parseLocal(t.dueAt!) }))
      .filter((x) => !!x.due)
      .map((x) => ({ t: x.t, remind: new Date(x.due!.getTime() - before * 60_000), due: x.due! }))
      .filter((x) => x.remind.getTime() > now)
      .sort((a, b) => a.remind.getTime() - b.remind.getTime())
      .slice(0, MAX_TASK_NOTIFS);
    for (const { t, remind, due } of upcoming) {
      const late = remind.getTime() + before * 60_000 > due.getTime();
      items.push({
        id: hashId(`t:${t.id}`),
        title: t.title,
        body: late ? "⏰" : `⏰ ${pad2(remind.getHours())}:${pad2(remind.getMinutes())}`,
        at: remind,
      });
    }
  }

  // 1b) "Budilnik kabi" vazifalar — vazifa VAQTIDA to'liq ovozli signal:
  // alarm kanali + ongoing bildirishnoma + in-app zang (topshiriqli o'chirish)
  for (const t of alarmLikeTasks) {
    const due = parseLocal(t.dueAt!);
    if (!due || due.getTime() <= now) continue;
    const ring: PendingRing = {
      key: ringKey("task", t.id, due),
      kind: "task",
      title: t.title,
      body: "⏰",
      at: isoLocal(due),
      challenge: true,
      time: `${pad2(due.getHours())}:${pad2(due.getMinutes())}`,
    };
    items.push({
      id: ringNotifId(ring.key),
      title: t.title,
      body: "⏰",
      at: due,
      channel: "alarm",
      ongoing: true,
    });
    taskRings.push(ring);
  }

  // 2) Odat eslatmasi — har kuni belgilangan vaqtda
  if (settings.notifHabitTime) {
    const at = nextDaily(settings.notifHabitTime);
    if (at) {
      items.push({
        id: hashId("habit-daily"),
        title: labels.habitTitle,
        body: labels.habitBody,
        at,
        daily: true,
      });
    }
  }

  // 3) Ertalabki reja — har kuni belgilangan vaqtda
  if (settings.notifMorningTime) {
    const at = nextDaily(settings.notifMorningTime);
    if (at) {
      items.push({
        id: hashId("morning-daily"),
        title: labels.morningTitle,
        body: labels.morningBody,
        at,
        daily: true,
      });
    }
  }

  // 4) Yotish eslatmasi — uyqu moduli (wind-down)
  if (settings.sleepBedtime) {
    const wind = Math.max(0, settings.sleepWindMin ?? 30);
    const bt = nextDaily(settings.sleepBedtime);
    if (bt) {
      const at = new Date(bt.getTime() - wind * 60_000);
      if (at.getTime() <= now) at.setDate(at.getDate() + 1);
      items.push({
        id: hashId("sleep-bedtime"),
        title: labels.bedtimeTitle ?? "Uyqu vaqti",
        body: labels.bedtimeBody ?? "",
        at,
        daily: true,
      });
    }
  }

  if (items.length === 0) return { granted: true, scheduled: 0, taskRings };

  const schema = items.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    smallIcon: "ic_stat_notify",
    channelId: n.channel ?? "reminders",
    ...(n.ongoing ? { ongoing: true } : {}),
    schedule: {
      at: n.at,
      allowWhileIdle: true,
      exact: true,
      ...(n.daily ? { every: "day" as const } : {}),
    },
  }));

  try {
    await LocalNotifications.schedule({ notifications: schema as never });
  } catch {
    // Exact alarm ruxsati bo'lmasa — aniqsiz rejada davom (kechikishi mumkin)
    try {
      await LocalNotifications.schedule({
        notifications: schema.map((n) => ({
          ...n,
          schedule: { ...n.schedule, exact: false },
        })) as never,
      });
    } catch {
      return { granted: true, scheduled: 0, taskRings };
    }
  }
  return { granted: true, scheduled: schema.length, taskRings };
}

/** Sinov bildirishnomasi — foydalanuvchi tizim ishlayaptimi darhol ko'radi */
export async function notifTestNow(title: string, body: string): Promise<boolean> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashId(`test-${Date.now()}`),
          title,
          body,
          smallIcon: "ic_stat_notify",
          channelId: "reminders",
          schedule: { at: new Date(Date.now() + 5_000), exact: false },
        } as never,
      ],
    });
    return true;
  } catch {
    return false;
  }
}
