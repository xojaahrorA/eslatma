"use client";

/**
 * ─── Barmoq izi / yuz bilan ochish (JS ko'prik) ──────────────────────────────
 * APK ichida: native BiometricAuth plagini (BiometricPrompt) chaqiriladi.
 * Brauzerda: biometriya mavjud emas — funksiyalar o'zicha false qaytaradi.
 * Hech qanday biometrik ma'lumot JS'ga kelmaydi — faqat ok: true/false.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface BiometricPluginInterface {
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  authenticate(opts: {
    title: string;
    reason?: string;
    cancel?: string;
  }): Promise<{ ok: boolean; code?: number }>;
}

const BiometricAuth = registerPlugin<BiometricPluginInterface>("BiometricAuth");

export const inApk = () =>
  typeof window !== "undefined" && "Capacitor" in window && Capacitor.isNativePlatform();

/** Qurilma barmoq izi/yuz skanerini qo'llab-quvvatlaydimi (faqat APK'da true bo'ladi) */
export async function biometricAvailable(): Promise<boolean> {
  if (!inApk()) return false;
  try {
    return (await BiometricAuth.isAvailable()).available;
  } catch {
    return false;
  }
}

/** Tizim biometrik dialogini ko'rsatish. true = muvaffaqiyatli */
export async function biometricPrompt(opts: {
  title: string;
  reason?: string;
  cancel?: string;
}): Promise<boolean> {
  if (!inApk()) return false;
  try {
    return (await BiometricAuth.authenticate(opts)).ok;
  } catch {
    return false;
  }
}
