"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip } from "./kit";
import { cn } from "@/lib/utils";
import { sha256Hex } from "./lock-screen";
import PinField from "./pin-field";
import { biometricAvailable } from "@/lib/biometric";
import { PROVIDERS, byokReady, callByok } from "@/lib/ai-gateway";
import type { ExperienceLevel, FontScale, Lang, ThemeMode } from "@/lib/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  MonitorSmartphone,
  Moon,
  Palette,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Type,
  Wallet,
  Zap,
} from "lucide-react";

const LANGS: { value: Lang; label: string; sub: string }[] = [
  { value: "uz", label: "O'zbek", sub: "lotin" },
  { value: "ru", label: "Русский", sub: "" },
  { value: "en", label: "English", sub: "" },
];

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun; preview: string }[] = [
  { value: "light", label: "set.theme.light", icon: Sun, preview: "bg-gradient-to-br from-zinc-100 to-white" },
  { value: "dark", label: "set.theme.dark", icon: Moon, preview: "bg-gradient-to-br from-violet-950 to-zinc-900" },
  { value: "amoled", label: "set.theme.amoled", icon: Palette, preview: "bg-gradient-to-br from-black to-zinc-900" },
];

const LEVELS: { value: ExperienceLevel; icon: typeof Zap }[] = [
  { value: "simple", icon: Sparkles },
  { value: "active", icon: Zap },
  { value: "power", icon: Palette },
  { value: "dev", icon: MonitorSmartphone },
];

const LEVEL_RANK: Record<ExperienceLevel, number> = { simple: 0, active: 1, power: 2, dev: 3 };

/** Har bir daraja nima ochadi — bo'lim ostida jonli ro'yxat sifatida ko'rinadi (PRD 8) */
const LEVEL_FX: { key: string; min?: ExperienceLevel; only?: ExperienceLevel }[] = [
  { key: "set.level.fx0", only: "simple" },
  { key: "set.level.fx1", min: "active" },
  { key: "set.level.fx2", min: "active" },
  { key: "set.level.fx3", min: "power" },
  { key: "set.level.fx4", min: "dev" },
];

const PRINCIPLES = [
  "Tezlik",
  "Oflayn birinchi",
  "Egalik",
  "Maxfiylik",
  "Kam ruxsat",
  "Shaffoflik",
  "Qaytarish",
  "Jazolamaslik",
  "Oddiylik",
  "Moslashuvchanlik",
  "Batareya",
  "Halollik",
];

const groupDigits = (s: string) => s.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function SettingsView() {
  const { t } = useUlos();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const exportAll = useStore((s) => s.exportAll);
  const wipeAll = useStore((s) => s.wipeAll);
  const seedDemo = useStore((s) => s.seedDemo);

  // ─── Ekran qulfi holati ───
  const [pinDialog, setPinDialog] = useState<"set" | "off" | null>(null);
  const [pinNew, setPinNew] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");
  const [pinCur, setPinCur] = useState("");
  const [pinShake, setPinShake] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const PIN_RE = /^\d{4,8}$/;

  // Qurilma barmoq izini qo'llaydimi (faqat APK'da true)
  useEffect(() => {
    let alive = true;
    biometricAvailable().then((ok) => alive && setBioAvail(ok));
    return () => {
      alive = false;
    };
  }, []);

  const shakeErr = () => {
    setPinShake(true);
    setTimeout(() => setPinShake(false), 450);
  };

  const enableLock = async () => {
    if (!PIN_RE.test(pinNew) || !PIN_RE.test(pinRepeat)) {
      shakeErr();
      import("sonner").then(({ toast }) => toast.error(t("sec.badDigits")));
      return;
    }
    if (pinNew !== pinRepeat) {
      shakeErr();
      import("sonner").then(({ toast }) => toast.error(t("sec.mismatch")));
      return;
    }
    const h = await sha256Hex(pinNew);
    setSettings({ lockEnabled: true, lockPinHash: h, lockPinLen: pinNew.length });
    setPinDialog(null);
    setPinNew("");
    setPinRepeat("");
    import("sonner").then(({ toast }) => toast.success(t("sec.saved")));
  };

  const disableLock = async () => {
    if (!settings.lockPinHash) return;
    const h = await sha256Hex(pinCur);
    if (h !== settings.lockPinHash) {
      shakeErr();
      import("sonner").then(({ toast }) => toast.error(t("sec.wrongPin")));
      return;
    }
    setSettings({ lockEnabled: false, lockPinHash: null, lockPinLen: null, lockBiometric: false });
    setPinDialog(null);
    setPinCur("");
    import("sonner").then(({ toast }) => toast(t("sec.disabled")));
  };

  /** Barmoq izini yoqish/o'chirish (PIN faol bo'lgandagina ko'rinadi) */
  const toggleBiometric = (v: boolean) => {
    setSettings({ lockBiometric: v });
    import("sonner").then(({ toast }) => toast(v ? t("sec.biometricSaved") : t("sec.biometricOff")));
  };

  // ─── O'z AI kaliti (BYOK) ───
  const [byokOpen, setByokOpen] = useState(false);
  const [byokBase, setByokBase] = useState(settings.aiBaseUrl ?? "");
  const [byokModel, setByokModel] = useState(settings.aiModel ?? "");
  const [byokKeyDraft, setByokKeyDraft] = useState("");
  const [byokShowKey, setByokShowKey] = useState(false);
  const [byokTesting, setByokTesting] = useState(false);

  const pickProvider = (id: (typeof PROVIDERS)[number]["id"]) => {
    const pr = PROVIDERS.find((p) => p.id === id)!;
    const base = pr.id === "custom" ? settings.aiBaseUrl ?? "" : pr.baseUrl;
    const model = pr.id === "custom" ? settings.aiModel ?? "" : pr.model;
    setSettings({ aiProvider: id, aiBaseUrl: base, aiModel: model });
    setByokBase(base);
    setByokModel(model);
  };

  const saveByok = () => {
    const base = byokBase.trim();
    const model = byokModel.trim();
    const key = byokKeyDraft.trim() || settings.aiKey || "";
    if (!base || !model || !key) {
      import("sonner").then(({ toast }) => toast.error(t("set.byokMissing")));
      return;
    }
    setSettings({ aiBaseUrl: base, aiModel: model, aiKey: key });
    setByokKeyDraft("");
    import("sonner").then(({ toast }) => toast.success(t("set.byokSaved")));
  };

  const testByok = async () => {
    const base = byokBase.trim();
    const model = byokModel.trim();
    const key = byokKeyDraft.trim() || settings.aiKey || "";
    if (!base || !model || !key) {
      import("sonner").then(({ toast }) => toast.error(t("set.byokMissing")));
      return;
    }
    setByokTesting(true);
    const r = await callByok({
      baseUrl: base,
      model,
      apiKey: key,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    });
    setByokTesting(false);
    import("sonner").then(({ toast }) => {
      if (r.ok) toast.success(t("set.byokTestOk"));
      else toast.error(t("set.byokTestFail").replace("{e}", r.error.slice(0, 80)));
    });
  };

  const delByok = () => {
    setSettings({ aiProvider: undefined, aiBaseUrl: undefined, aiModel: undefined, aiKey: undefined });
    setByokBase("");
    setByokModel("");
    setByokKeyDraft("");
    import("sonner").then(({ toast }) => toast(t("set.byokDeleted")));
  };

  /** Darajani o'zgartirish — darhol saqlanadi + foydalanuvchiga toast bilan ko'rsatiladi */
  const changeLevel = (v: ExperienceLevel) => {
    if (settings.level === v) return;
    setSettings({ level: v });
    import("sonner").then(({ toast }) =>
      toast(t("set.savedLevel"), {
        description: `${t(`set.level.${v}`)} — ${t(`set.level.${v}Sub`)}`,
      })
    );
  };

  const fxOn = (fx: (typeof LEVEL_FX)[number]) =>
    fx.only ? settings.level === fx.only : LEVEL_RANK[settings.level] >= LEVEL_RANK[fx.min ?? "simple"];

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    import("sonner").then(({ toast }) => toast.success(t("set.exported")));
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* ─── Til ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-teal-500" />
          <h3 className="text-sm font-bold">{t("set.lang")}</h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {LANGS.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                setSettings({ lang: l.value });
                document.documentElement.lang = l.value;
              }}
              className={cn(
                "rounded-2xl border py-2.5 text-sm font-semibold transition-all active:scale-95",
                settings.lang === l.value
                  ? "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ─── Mavzu ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-bold">{t("set.theme")}</h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {THEMES.map((th) => (
            <button
              key={th.value}
              onClick={() => setSettings({ theme: th.value })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all active:scale-95",
                settings.theme === th.value ? "border-violet-500/50 bg-violet-500/10" : "border-border bg-card"
              )}
            >
              <span className={cn("h-9 w-full rounded-xl border border-border", th.preview)} />
              <span className={cn("text-[11px] font-semibold", settings.theme === th.value ? "text-violet-600 dark:text-violet-300" : "text-muted-foreground")}>
                {t(th.label)}
              </span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ─── Shrift ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Type className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold">{t("set.font")}</h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(["small", "normal", "large"] as FontScale[]).map((f) => (
            <button
              key={f}
              onClick={() => setSettings({ fontScale: f })}
              className={cn(
                "rounded-2xl border py-2.5 transition-all active:scale-95",
                f === "small" ? "text-xs" : f === "normal" ? "text-sm" : "text-base",
                settings.fontScale === f
                  ? "border-amber-500/40 bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-300"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {t(`set.font.${f}`)}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ─── Tajriba darajasi (PRD 8) — darhol ta'sir qiladi ─── */}
      <SectionCard>
        <div className="mb-1 flex items-center gap-2">
          <Zap className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-bold">{t("set.level")}</h3>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">{t("set.levelHint")}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => changeLevel(l.value)}
              className={cn(
                "flex items-start gap-2 rounded-2xl border p-3 text-left transition-all active:scale-[0.98]",
                settings.level === l.value
                  ? "border-rose-500/40 bg-rose-500/[0.07]"
                  : "border-border bg-card"
              )}
            >
              <l.icon className={cn("mt-0.5 h-4 w-4 shrink-0", settings.level === l.value ? "text-rose-500" : "text-muted-foreground")} />
              <div>
                <p className={cn("text-xs font-bold", settings.level === l.value && "text-rose-600 dark:text-rose-300")}>
                  {t(`set.level.${l.value}`)}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{t(`set.level.${l.value}Sub`)}</p>
              </div>
            </button>
          ))}
        </div>
        {/* Jonli holat: bu darajada nima ochilgan — o'zgarish darhol ko'rinadi */}
        <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-muted/50 p-3">
          {LEVEL_FX.map((fx) => {
            const on = fxOn(fx);
            return (
              <div
                key={fx.key}
                className={cn(
                  "flex items-center gap-2 text-[11px] transition-colors",
                  on ? "font-medium text-foreground" : "text-muted-foreground/45"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                    on ? "bg-rose-500 text-white" : "border border-border bg-card"
                  )}
                >
                  {on && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
                {t(fx.key)}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ─── AI ─── */}
      <SectionCard className={cn(!settings.aiEnabled && "border-rose-500/30")}>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-fuchsia-500" />
          <h3 className="text-sm font-bold">{t("set.ai")}</h3>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3">
          <div className="min-w-0">
            <p className="text-xs font-bold">{t("set.aiEnable")}</p>
            <p className="text-[10px] text-muted-foreground">{t("set.aiEnableSub")}</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.aiEnabled}
            onClick={() => setSettings({ aiEnabled: !settings.aiEnabled })}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              settings.aiEnabled ? "bg-emerald-500" : "bg-rose-500"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                settings.aiEnabled ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>
        {!settings.aiEnabled && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-500">
            <ShieldOff className="h-3.5 w-3.5" /> {t("ai.killSwitch")}
          </p>
        )}
        {/* Kunlik AI limiti — «Kuchli» darajasidan boshlab (PRD 8: nazorat) */}
        {LEVEL_RANK[settings.level] >= LEVEL_RANK.power && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium">{t("set.aiLimit")}</p>
            <div className="flex gap-1">
              {[5, 10, 20, 50].map((n) => (
                <Chip
                  key={n}
                  onClick={() => setSettings({ aiDailyLimit: n })}
                  className={cn(
                    "cursor-pointer px-3 py-1",
                    settings.aiDailyLimit === n
                      ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium">{t("set.name")}</p>
          <input
            value={settings.userName}
            onChange={(e) => setSettings({ userName: e.target.value })}
            placeholder="…"
            className="w-32 rounded-xl bg-muted px-3 py-1.5 text-sm outline-none"
          />
        </div>
      </SectionCard>

      {/* ─── O'z AI kaliti (BYOK) ─── */}
      <SectionCard>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-cyan-500" />
          <h3 className="flex-1 text-sm font-bold">{t("set.byok")}</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-bold",
              byokReady(settings) ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
            )}
          >
            {byokReady(settings) ? t("set.byokActive") : t("set.byokInactive")}
          </span>
          <button
            onClick={() => setByokOpen((o) => !o)}
            aria-label={byokOpen ? "close" : t("set.byokOpen")}
            className="rounded-xl bg-muted p-2 text-muted-foreground"
          >
            {byokOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{t("set.byokSub")}</p>

        {byokOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {/* Provayder tanlash */}
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("set.byokProvider")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROVIDERS.map((p) => (
                  <Chip
                    key={p.id}
                    onClick={() => pickProvider(p.id)}
                    className={cn(
                      "cursor-pointer px-3 py-1.5 text-[11px]",
                      settings.aiProvider === p.id
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {p.id === "custom" ? t("set.byokCustom") : p.id}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Base URL */}
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("set.byokBase")}
              </p>
              <input
                value={byokBase}
                onChange={(e) => setByokBase(e.target.value)}
                placeholder="https://api.deepseek.com"
                dir="ltr"
                className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-xs outline-none"
              />
            </div>

            {/* Model */}
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("set.byokModel")}
              </p>
              <input
                value={byokModel}
                onChange={(e) => setByokModel(e.target.value)}
                placeholder="deepseek-chat"
                dir="ltr"
                className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-xs outline-none"
              />
            </div>

            {/* API kaliti */}
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("set.byokKey")}
              </p>
              <div className="relative">
                <input
                  type={byokShowKey ? "text" : "password"}
                  value={byokKeyDraft}
                  onChange={(e) => setByokKeyDraft(e.target.value)}
                  placeholder={settings.aiKey ? "•".repeat(12) + " (saqlangan)" : "sk-…"}
                  autoComplete="off"
                  dir="ltr"
                  className="w-full rounded-xl bg-muted px-3.5 py-2.5 pr-11 font-mono text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => setByokShowKey((v) => !v)}
                  aria-label="show key"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:text-foreground"
                >
                  {byokShowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Amallar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={testByok}
                disabled={byokTesting}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-600 transition-transform active:scale-95 disabled:opacity-50 dark:text-cyan-300"
              >
                {byokTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {t("set.byokTest")}
              </button>
              <button
                onClick={saveByok}
                className="brand-grad rounded-xl px-5 py-2 text-xs font-bold text-white transition-transform active:scale-95"
              >
                {t("set.byokSave")}
              </button>
              {settings.aiKey && (
                <button
                  onClick={delByok}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                >
                  {t("set.byokDelete")}
                </button>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ─── Moliya byudjeti ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold">{t("set.budget")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            defaultValue={groupDigits(String(settings.financeBudget || ""))}
            key={settings.financeBudget}
            onBlur={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ""));
              if (n >= 0 && n !== settings.financeBudget) {
                setSettings({ financeBudget: n });
                e.target.value = groupDigits(String(n));
                import("sonner").then(({ toast }) => toast(t("set.saved")));
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="2 000 000"
            className="flex-1 rounded-xl bg-muted px-3.5 py-2.5 text-sm font-bold tabular-nums outline-none"
          />
          <span className="text-xs text-muted-foreground">{t("fin.currency")}</span>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{t("fin.budgetSub")}</p>
      </SectionCard>

      {/* ─── Pomodoro vaqtlari — «Oddiy» darajada yashiriladi (soddalashtirish) ─── */}
      {LEVEL_RANK[settings.level] >= LEVEL_RANK.active && (
        <SectionCard>
          <div className="mb-3 flex items-center gap-2">
            <Timer className="h-4 w-4 text-teal-500" />
            <h3 className="text-sm font-bold">{t("set.focusTimes")}</h3>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">{t("set.workMin")}</label>
              <input
                type="number"
                min={5}
                max={120}
                defaultValue={settings.focusWorkMin}
                key={`w${settings.focusWorkMin}`}
                onBlur={(e) => {
                  const n = Math.min(120, Math.max(5, Number(e.target.value) || 25));
                  if (n !== settings.focusWorkMin) {
                    setSettings({ focusWorkMin: n });
                    e.target.value = String(n);
                    import("sonner").then(({ toast }) => toast(t("set.saved")));
                  }
                }}
                className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-sm font-bold tabular-nums outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">{t("set.breakMin")}</label>
              <input
                type="number"
                min={1}
                max={60}
                defaultValue={settings.focusBreakMin}
                key={`b${settings.focusBreakMin}`}
                onBlur={(e) => {
                  const n = Math.min(60, Math.max(1, Number(e.target.value) || 5));
                  if (n !== settings.focusBreakMin) {
                    setSettings({ focusBreakMin: n });
                    e.target.value = String(n);
                    import("sonner").then(({ toast }) => toast(t("set.saved")));
                  }
                }}
                className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-sm font-bold tabular-nums outline-none"
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ─── Xavfsizlik: ekran qulfi (PIN) + barmoq izi ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-bold">{t("sec.title")}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-500/10 p-2 text-violet-500">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold">{t("sec.lock")}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t("sec.lockSub")}</p>
          </div>
          <Switch
            checked={settings.lockEnabled && !!settings.lockPinHash}
            onCheckedChange={(v) => {
              if (v) {
                setPinNew("");
                setPinRepeat("");
                setPinDialog("set");
              } else {
                setPinCur("");
                setPinDialog("off");
              }
            }}
          />
        </div>

        {/* Barmoq izi — PIN yoqilgandagina ko'rinadi */}
        {settings.lockEnabled && !!settings.lockPinHash && (
          <div className="mt-3 border-t border-border/50 pt-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-500">
                <Fingerprint className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className={cn("text-xs font-bold", !bioAvail && "text-muted-foreground")}>
                  {t("sec.biometric")}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {!bioAvail ? t("sec.biometricNa") : t("sec.biometricSub")}
                </p>
              </div>
              <Switch
                checked={!!settings.lockBiometric && bioAvail}
                disabled={!bioAvail}
                onCheckedChange={toggleBiometric}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* PIN o'rnatish dialogi */}
      <Dialog open={pinDialog === "set"} onOpenChange={(o) => !o && setPinDialog(null)}>
        <DialogContent className="max-w-[340px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="h-4 w-4 text-violet-500" />
              {t("sec.setPin")}
            </DialogTitle>
            <DialogDescription>{t("sec.setPinSub")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("sec.pinNew")}
              </p>
              <PinField value={pinNew} onChange={setPinNew} shake={pinShake} />
            </div>
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("sec.pinRepeat")}
              </p>
              <PinField
                value={pinRepeat}
                onChange={setPinRepeat}
                onSubmit={enableLock}
                shake={pinShake}
                autoFocus={false}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setPinDialog(null)} className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">
              {t("common.cancel")}
            </button>
            <button
              onClick={enableLock}
              disabled={!PIN_RE.test(pinNew) || !PIN_RE.test(pinRepeat)}
              className="brand-grad rounded-xl px-5 py-2 text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
            >
              {t("common.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN o'chirish dialogi */}
      <Dialog open={pinDialog === "off"} onOpenChange={(o) => !o && setPinDialog(null)}>
        <DialogContent className="max-w-[340px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldOff className="h-4 w-4 text-rose-500" />
              {t("sec.removePin")}
            </DialogTitle>
            <DialogDescription>{t("sec.removePinSub")}</DialogDescription>
          </DialogHeader>
          <div>
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("sec.pinCurrent")}
            </p>
            <PinField value={pinCur} onChange={setPinCur} onSubmit={disableLock} shake={pinShake} />
          </div>
          <DialogFooter>
            <button onClick={() => setPinDialog(null)} className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">
              {t("common.cancel")}
            </button>
            <button
              onClick={disableLock}
              disabled={!PIN_RE.test(pinCur)}
              className="rounded-xl bg-rose-500 px-5 py-2 text-xs font-bold text-white transition-transform active:scale-95 hover:bg-rose-600 disabled:opacity-40"
            >
              {t("common.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ma'lumot egaligi (PRD 1.3) ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Download className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-bold">{t("set.data")}</h3>
        </div>
        <button
          onClick={doExport}
          className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 p-3 text-left transition-colors hover:bg-muted"
        >
          <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
            <Download className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold">{t("set.export")}</p>
            <p className="text-[10px] text-muted-foreground">{t("set.exportSub")}</p>
          </div>
        </button>
        <button
          onClick={() => {
            seedDemo();
            import("sonner").then(({ toast }) => toast(t("set.seedDone")));
          }}
          className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-muted/60 p-3 text-left transition-colors hover:bg-muted"
        >
          <span className="rounded-xl bg-sky-500/10 p-2 text-sky-500">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold">{t("set.seed")}</p>
            <p className="text-[10px] text-muted-foreground">{t("set.seedSub")}</p>
          </div>
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-rose-500/[0.06] p-3 text-left transition-colors hover:bg-rose-500/10">
              <span className="rounded-xl bg-rose-500/10 p-2 text-rose-500">
                <Trash2 className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{t("set.wipe")}</p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[340px] rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("set.wipe")}</AlertDialogTitle>
              <AlertDialogDescription>{t("set.wipeConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  wipeAll();
                  import("sonner").then(({ toast }) => toast(t("set.wipeDone")));
                }}
                className="rounded-xl bg-rose-500 text-white hover:bg-rose-600"
              >
                {t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SectionCard>

      {/* ─── PWA o'rnatish ─── */}
      <SectionCard className="brand-grad-soft">
        <div className="flex items-start gap-3">
          <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
          <div>
            <p className="text-xs font-bold">{t("set.install")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t("set.installSub")}</p>
          </div>
        </div>
      </SectionCard>

      {/* ─── Loyiha haqida ─── */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-bold">{t("set.about")}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("set.aboutSub")}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {PRINCIPLES.map((p, i) => (
            <Chip key={p} className="border-border bg-muted/60">
              {i + 1}. {p}
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground/60">Universal Life OS · v1.0 · PRD v2.0</p>
      </SectionCard>
    </div>
  );
}
