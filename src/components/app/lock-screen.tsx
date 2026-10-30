"use client";

/**
 * ─── Ekran qulfi (PRD 4.9 xavfsizlik) ───────────────────────────────────────
 * PIN 4–8 raqam. Ochiq matn HECH QACHON saqlanmaydi — faqat SHA-256 hash.
 * 5 marta xato → 30 soniya kutish (brute-force himoyasi).
 * Barmoq izi yoqilgan bo'lsa — tizim BiometricPrompt'i avtomatik chiqadi,
 * PIN esa zaxira usul bo'lib qoladi.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Delete, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeT } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { biometricAvailable, biometricPrompt } from "@/lib/biometric";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const MAX_LEN = 8;
const MAX_TRIES = 5;
const COOLDOWN_S = 30;

export default function LockScreen({
  pinHash,
  pinLen,
  lang,
  biometric = false,
  onUnlock,
}: {
  pinHash: string;
  pinLen: number | null;
  lang: Lang;
  biometric?: boolean;
  onUnlock: () => void;
}) {
  const t = useMemo(() => makeT(lang), [lang]);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [tries, setTries] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [bioOk, setBioOk] = useState(false);
  const busy = useRef(false);
  const bioBusy = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Qurilma biometriyani qo'llaydimi (faqat APK'da true)
  useEffect(() => {
    if (!biometric) return;
    let alive = true;
    biometricAvailable().then((ok) => alive && setBioOk(ok));
    return () => {
      alive = false;
    };
  }, [biometric]);

  const runBiometric = async () => {
    if (!bioOk || bioBusy.current || cooldown > 0) return;
    bioBusy.current = true;
    const ok = await biometricPrompt({
      title: t("sec.biometricTitle"),
      reason: t("sec.biometricReason"),
      cancel: t("sec.biometricCancel"),
    });
    bioBusy.current = false;
    if (ok) {
      setTries(0);
      setPin("");
      onUnlock();
    }
  };

  // Qulf ekrani ko'rinishi bilan barmoq izi avtomatik so'raladi
  useEffect(() => {
    if (bioOk) void runBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioOk]);

  const fail = () => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
    setPin("");
    submittedFor.current = "";
    const n = tries + 1;
    setTries(n);
    if (n >= MAX_TRIES) {
      setCooldown(COOLDOWN_S);
      setTries(0);
    }
  };

  const submit = async (value: string) => {
    if (busy.current || cooldown > 0) return;
    busy.current = true;
    const h = await sha256Hex(value);
    busy.current = false;
    if (h === pinHash) {
      setPin("");
      setTries(0);
      onUnlock();
    } else {
      fail();
    }
  };

  const push = (d: string) => {
    if (cooldown > 0) return;
    setPin((p) => (p + d).slice(0, MAX_LEN));
  };

  // Saqlangan uzunlikka yetilganda avtomatik tekshirish (tezkor bosishlarda ham ishonchli)
  const submittedFor = useRef("");
  useEffect(() => {
    if (!pinLen || pin.length !== pinLen) return;
    if (submittedFor.current === pin) return;
    submittedFor.current = pin;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    void submit(pin);
  }, [pin, pinLen]);

  // Qo'lda tasdiqlash — uzunlik ma'lum bo'lmagan eski holatlar uchun zaxira
  const tryUnlock = () => {
    if (pin.length >= 4) void submit(pin);
    else fail();
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  const keyCls =
    "flex h-16 w-full items-center justify-center rounded-[1.25rem] border border-white/[0.06] bg-white/[0.045] text-2xl font-bold tabular-nums text-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] transition-all duration-150 hover:bg-white/[0.09] active:scale-[0.94] active:bg-white/[0.12] disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-background px-8",
        shake && "animate-[lockshake_0.45s_ease-in-out]"
      )}
    >
      {/* Dekorativ gradient nur sharchalari */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-600/25 blur-[100px]" />
        <div className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-cyan-500/[0.14] blur-[110px]" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-fuchsia-600/[0.13] blur-[100px]" />
      </div>

      {/* Logo */}
      <div className="brand-grad relative flex h-[72px] w-[72px] items-center justify-center rounded-[1.6rem] shadow-2xl shadow-fuchsia-500/30">
        <LockKeyhole className="h-8 w-8 text-white" />
        <div className="absolute inset-0 rounded-[1.6rem] ring-1 ring-inset ring-white/25" />
      </div>
      <p className="relative mt-6 text-xl font-bold tracking-tight">{t("sec.lockTitle")}</p>
      <p className="relative mt-1 text-[13px] text-muted-foreground">{t("sec.lockSub2")}</p>

      {/* PIN nuqtalar */}
      <div className="relative mt-8 flex h-9 items-center gap-3" aria-label="pin dots">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3.5 w-3.5 rounded-full border-2 transition-all duration-200",
              i < pin.length
                ? "scale-110 border-transparent bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-[0_0_12px_-1px] shadow-fuchsia-500/70"
                : "border-muted-foreground/35"
            )}
          />
        ))}
      </div>

      {cooldown > 0 ? (
        <p className="relative mt-4 flex items-center gap-2 text-sm font-bold text-rose-500">
          <ShieldCheck className="h-4 w-4" />
          {t("sec.cooldown").replace("{s}", String(cooldown))}
        </p>
      ) : tries > 0 ? (
        <p className="relative mt-4 text-xs font-semibold text-rose-500">{t("sec.wrong")}</p>
      ) : (
        <p className="relative mt-4 h-4 text-xs" />
      )}

      {/* Numpad */}
      <div className="relative mt-5 grid w-full max-w-[300px] grid-cols-3 gap-3">
        {keys.map((k) => (
          <button key={k} onClick={() => push(k)} disabled={cooldown > 0} className={keyCls}>
            {k}
          </button>
        ))}
        {/* Barmoq izi — chap pastki katak; qo'llanmasa bo'sh joy */}
        {bioOk ? (
          <button
            onClick={runBiometric}
            disabled={cooldown > 0}
            aria-label={t("sec.biometric")}
            className={cn(
              "group relative flex h-16 w-full items-center justify-center rounded-[1.25rem] text-violet-400 transition-all duration-150 active:scale-[0.94] disabled:opacity-40",
              !cooldown && "animate-[biopulse_2.2s_ease-in-out_infinite]"
            )}
          >
            <Fingerprint className="h-8 w-8 transition-transform group-active:scale-90" />
          </button>
        ) : (
          <span />
        )}
        <button onClick={() => push("0")} disabled={cooldown > 0} className={keyCls}>
          0
        </button>
        <button
          onClick={() => (pin ? setPin((p) => p.slice(0, -1)) : undefined)}
          disabled={cooldown > 0}
          aria-label="delete"
          className="flex h-16 w-full items-center justify-center rounded-[1.25rem] text-muted-foreground transition-all duration-150 hover:bg-white/[0.06] active:scale-[0.94] disabled:opacity-40"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>

      {bioOk && cooldown <= 0 && (
        <p className="relative mt-4 text-[11px] font-medium text-muted-foreground/80">
          {t("sec.orFinger")}
        </p>
      )}

      {pin.length >= 4 && pin.length < MAX_LEN && (
        <button
          onClick={tryUnlock}
          disabled={cooldown > 0}
          className="brand-grad relative mt-5 w-full max-w-[300px] rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          {t("sec.unlock")}
        </button>
      )}
    </div>
  );
}
