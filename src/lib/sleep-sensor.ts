"use client";

/**
 * ─── SleepSensor — native akselerometr kuzatuvi (faqat APK) ─────────────────
 * Native tomonda Foreground Service har daqiqalik harakat indeksini yozadi
 * (kontent fayl tizimida — hech qayerga jo'natilmaydi). Web'da: yo'q.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { inApkEnv } from "./notify";

export interface SensorStartResult {
  ok: boolean;
  reason?: string; // "web" | "no_sensor" | "error"
}
export interface SensorStopResult {
  ok: boolean;
  reason?: string;
  /** JSON: {sessionId, startAt, minutes:[{t, mv, pk}]} */
  data?: string;
}

interface SleepSensorPlugin {
  start(opts: { sessionId: string }): Promise<SensorStartResult>;
  stop(): Promise<SensorStopResult>;
  status(): Promise<{ running: boolean }>;
  available(): Promise<{ ok: boolean; reason?: string }>;
}

const SleepSensor = registerPlugin<SleepSensorPlugin>("SleepSensor");

export async function sensorStart(sessionId: string): Promise<SensorStartResult> {
  if (!inApkEnv()) return { ok: false, reason: "web" };
  try {
    return await SleepSensor.start({ sessionId });
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function sensorStop(): Promise<SensorStopResult> {
  if (!inApkEnv()) return { ok: false, reason: "web" };
  try {
    return await SleepSensor.stop();
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Sensor qurilmada mavjudmi (APK'da tekshiriladi) */
export async function sensorAvailable(): Promise<boolean> {
  if (!inApkEnv()) return false;
  try {
    const r = await SleepSensor.available();
    return !!r.ok;
  } catch {
    return false;
  }
}

/** Native plagin mavjudligi (web build'da xato bermasligi uchun) */
export const hasNativeSensorPlugin = () =>
  typeof window !== "undefined" && Capacitor.isNativePlatform();
