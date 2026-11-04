"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { makeT } from "@/lib/i18n";
import { inApk } from "@/lib/biometric";
import { UlosProvider, useMounted, type UlosCtxValue, type ViewName } from "@/components/app/kit";
import Dashboard from "@/components/app/dashboard";
import TasksView from "@/components/app/tasks-view";
import CalendarView from "@/components/app/calendar-view";
import GoalsView from "@/components/app/goals-view";
import NotesView from "@/components/app/notes-view";
import FocusView from "@/components/app/focus-view";
import FinanceView from "@/components/app/finance-view";
import AuditView from "@/components/app/audit-view";
import AnalyticsView from "@/components/app/analytics-view";
import AlarmView from "@/components/app/alarm-view";
import SleepView from "@/components/app/sleep-view";
import SettingsView from "@/components/app/settings-view";
import MoreView from "@/components/app/more-view";
import AISheet from "@/components/app/ai-sheet";
import LockScreen from "@/components/app/lock-screen";
import RingOverlay from "@/components/app/ring-overlay";
import { TaskEditorDrawer, MissSheet } from "@/components/app/task-editor";
import { syncNotifs } from "@/lib/notify";
import { syncAlarms, ringNotifId, scheduleRingNotif, cancelRingNotif, trackRingNotif } from "@/lib/alarm";
import { isoLocal, parseLocal } from "@/lib/utils-app";
import type { PendingRing, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  Download,
  ListTodo,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  LayoutGrid,
} from "lucide-react";

const NAV: { view: ViewName; icon: typeof Sunrise; key: string }[] = [
  { view: "today", icon: Sunrise, key: "nav.today" },
  { view: "tasks", icon: ListTodo, key: "nav.tasks" },
  { view: "calendar", icon: CalendarDays, key: "nav.calendar" },
  { view: "goals", icon: Sparkles, key: "nav.goals" },
  { view: "more", icon: LayoutGrid, key: "nav.more" },
];

export default function Home() {
  const mounted = useMounted();
  const settings = useStore((s) => s.settings);
  const tasks = useStore((s) => s.tasks);
  const alarms = useStore((s) => s.alarms);

  const [view, setView] = useState<ViewName>("today");
  const [navHistory, setNavHistory] = useState<ViewName[]>([]);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [missTask, setMissTask] = useState<Task | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  // Zang (signal) oynasi — budilnik va "budilnik kabi" eslatmalar uchun
  const [ringing, setRinging] = useState<PendingRing | null>(null);
  const ringingRef = useRef<PendingRing | null>(null);
  ringingRef.current = ringing;
  // APK banneri — faqat brauzerda (APK ichida yashirin), yopilsa sessiyada qaytmaydi.
  // "Capacitor" in window brauzerda ham true bo'lishi mumkin (@capacitor/core globali)
  // — shuning uchun isNativePlatform() bilan tekshiriladigan inApk() ishlatiladi.
  const [apkBannerClosed, setApkBannerClosed] = useState(false);
  const showApkBanner =
    mounted &&
    !apkBannerClosed &&
    typeof window !== "undefined" &&
    !inApk() &&
    sessionStorage.getItem("apk-banner-off") !== "1";
  const closeApkBanner = () => {
    setApkBannerClosed(true);
    sessionStorage.setItem("apk-banner-off", "1");
  };

  // ─── Ekran qulfi: PIN yoqilgan bo'lsa — har ochilishda va background'dan qaytganda ───
  const [unlocked, setUnlocked] = useState(false);
  const lockOn = mounted && settings.lockEnabled && !!settings.lockPinHash;
  const isLocked = lockOn && !unlocked;
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") setUnlocked(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const t = useMemo(() => makeT(settings.lang), [settings.lang]);

  // tema va shrift (PRD 4.10)
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", settings.theme !== "light");
    el.classList.toggle("amoled", settings.theme === "amoled");
    el.dataset.fs = settings.fontScale;
    el.lang = settings.lang;
  }, [settings.theme, settings.fontScale, settings.lang]);

  // ─── Eslatmalar sinxroni: vazifalar/sozlamalar o'zgarsa — qayta rejalash (debounce) ───
  // Budilnik bildirishnomalari keepIds orqali saqlanadi (syncAlarms o'zi boshqaradi)
  useEffect(() => {
    const tm = setTimeout(() => {
      const keep = new Set<number>();
      for (const r of useStore.getState().pendingRings) {
        if (r.kind === "alarm" || r.key.startsWith("snooze:")) keep.add(ringNotifId(r.key));
      }
      syncNotifs(tasks, settings, {
        habitTitle: t("notif.habitTitle"),
        habitBody: t("notif.habitBody"),
        morningTitle: t("notif.morningTitle"),
        morningBody: t("notif.morningBody"),
        bedtimeTitle: t("sleep.bedtimeNotifTitle"),
        bedtimeBody: t("sleep.bedtimeNotifBody"),
      }, keep)
        .then((res) => {
          // "budilnik kabi" vazifa zanglarini yangilash (budilnik va snooze zanglari saqlanadi)
          const prev = useStore.getState().pendingRings;
          const kept = prev.filter((r) => r.kind !== "task" || r.key.startsWith("snooze:"));
          useStore.getState().setPendingRings([...kept, ...res.taskRings]);
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(tm);
  }, [tasks, settings, t]);

  // ─── Budilniklar sinxroni: budilnik o'zgarsa — keyingi occurrence'ni qayta rejalash ───
  useEffect(() => {
    if (!mounted) return;
    const tm = setTimeout(() => {
      const prev = useStore.getState().pendingRings;
      syncAlarms(alarms, prev)
        .then((alarmRings) => {
          const taskRings = prev.filter((r) => r.kind === "task" && !r.key.startsWith("snooze:"));
          useStore.getState().setPendingRings([...alarmRings, ...taskRings]);
        })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(tm);
  }, [alarms, mounted]);

  // ─── Zang qo'riqchisi: vaqti kelgan signal'ni ko'rsatish (15 sekundda tekshiradi) ───
  // Ilova yopiq turganda bildirishnoma chaladi; qayta ochilganda shu watchdog
  // o'chirilmagan zangni to'liq ekranli oynada ko'rsatadi (o'chmaydigan signal).
  useEffect(() => {
    const check = () => {
      if (ringingRef.current) return;
      const rings = useStore.getState().pendingRings;
      const now = Date.now();
      const due = rings.find((r) => (parseLocal(r.at)?.getTime() ?? Infinity) <= now);
      if (due) setRinging(due);
    };
    check();
    const iv = window.setInterval(check, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ─── Bildirishnoma hodisalari: zang boshlandi / bosildi → oyna ochiladi ───
  useEffect(() => {
    if (!mounted) return;
    let removed = false;
    const handles: { remove: () => Promise<void> }[] = [];
    import("@capacitor/local-notifications")
      .then(({ LocalNotifications }) => {
        if (removed) return;
        void LocalNotifications.addListener("localNotificationReceived", (n) => {
          const ring = useStore.getState().pendingRings.find((r) => ringNotifId(r.key) === Number(n.id));
          if (ring && !ringingRef.current) setRinging(ring);
        });
        void LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
          const ring = useStore.getState().pendingRings.find((r) => ringNotifId(r.key) === Number(a.notification.id));
          if (ring) setRinging(ring);
        });
      })
      .catch(() => {});
    return () => {
      removed = true;
      handles.forEach((h) => void h.remove?.());
    };
  }, [mounted]);

  // ─── Zangni o'chirish (barcha missiyalar bajarilgach) ───
  const dismissRing = useCallback((ring: PendingRing) => {
    const st = useStore.getState();
    st.removePendingRing(ring.key);
    void cancelRingNotif(ring.key);
    // uyg'onish statistikasi — avtomatik yig'iladi (v1.8)
    if (ring.kind === "alarm" && ring.alarmId) {
      st.logRingOutcome(ring.alarmId, "win");
    }
    // bir martalik budilnik — o'chiriladi
    if (ring.kind === "alarm" && ring.alarmId && ring.once) {
      st.updateAlarm(ring.alarmId, { enabled: false });
    }
    setRinging(null);
    // takrorlanuvchi budilnik — keyingi kunni qayta rejalash
    setTimeout(() => {
      const cur = useStore.getState();
      const prev = cur.pendingRings;
      syncAlarms(cur.alarms, prev)
        .then((alarmRings) => {
          const taskRings = prev.filter((r) => r.kind === "task" && !r.key.startsWith("snooze:"));
          useStore.getState().setPendingRings([...alarmRings, ...taskRings]);
        })
        .catch(() => {});
    }, 400);
  }, []);

  // ─── Snooze: +N daqiqa — cheklov budilnikdan keladi (v1.8) ───
  const snoozeRing = useCallback((ring: PendingRing, min: number) => {
    const at = new Date(Date.now() + min * 60_000);
    const used = (ring.snoozeUsed ?? 0) + 1;
    const sr: PendingRing = {
      ...ring,
      key: `snooze:${ring.key}:${at.getTime()}`,
      at: isoLocal(at),
      once: true,
      snoozeUsed: used,
    };
    const st = useStore.getState();
    // statistika: snooze — zanjirni buzadi (moslashuvchan qiyinlik buni ko'radi)
    if (ring.kind === "alarm" && ring.alarmId) {
      st.logRingOutcome(ring.alarmId, "snooze", 1);
    }
    st.removePendingRing(ring.key);
    st.addPendingRing(sr);
    void cancelRingNotif(ring.key);
    void scheduleRingNotif(sr).then((ok) => {
      if (ok) trackRingNotif(sr.key);
    });
    setRinging(null);
  }, []);

  // Birinchi ochilish TOZA (0 ma'lumot) — namuna faqat Sozlamalar'dan qo'lda yuklanadi

  const navigate = useCallback(
    (v: ViewName) => {
      setNavHistory((h) => [...h.slice(-4), view]);
      setView(v);
    },
    [view]
  );

  const goBack = useCallback(() => {
    setNavHistory((h) => {
      const prev = h[h.length - 1] ?? "more";
      setView(prev);
      return h.slice(0, -1);
    });
  }, []);

  // ─── APK: apparat orqa tugmasi — drawerlar yopiladi → sub-view'dan orqaga → background ───
  useEffect(() => {
    if (!inApk()) return;
    let removed = false;
    let handle: { remove: () => Promise<void> } | null = null;
    import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("backButton", () => {
          // Qulf ekranida orqa tugma — hech narsani chetlab o'tib bo'lmaydi
          if (lockOn && !unlocked) {
            void App.minimizeApp();
            return;
          }
          // Zang oynasi ochiq — orqa tugma bilan chetlab o'tib bo'lmaydi
          // (notification ongoing — background'dan qaytganda yana ko'rinadi)
          if (ringingRef.current) return;
          // 1) Ochiq drawerlar — avval ular yopiladi
          if (editorOpen) {
            setEditorOpen(false);
            return;
          }
          if (aiOpen) {
            setAiOpen(false);
            return;
          }
          if (missTask) {
            setMissTask(null);
            return;
          }
          // 2) Asosiy tab — ilova backgroundga (home tugmasi kabi, jarayon saqlanadi)
          if (NAV.some((n) => n.view === view)) {
            void App.minimizeApp();
            return;
          }
          // 3) Sub-view — ichki orqaga
          goBack();
        })
      )
      .then((h) => {
        if (h && !removed) handle = h as unknown as { remove: () => Promise<void> };
      })
      .catch(() => {});
    return () => {
      removed = true;
      void handle?.remove?.();
    };
  }, [editorOpen, aiOpen, missTask, view, goBack, lockOn, unlocked]);

  const openEditor = useCallback((task?: Task) => {
    setEditorTask(task ?? null);
    setEditorOpen(true);
  }, []);

  const openMiss = useCallback((task: Task) => setMissTask(task), []);
  const openAI = useCallback(() => setAiOpen(true), []);

  const startFocus = useCallback(
    (taskId?: string) => {
      if (taskId) sessionStorage.setItem("ulos-focus-task", taskId);
      setNavHistory((h) => [...h.slice(-4), view]);
      setView("focus");
    },
    [view]
  );

  const ctx: UlosCtxValue = useMemo(
    () => ({
      t,
      lang: settings.lang,
      level: settings.level,
      view,
      navigate,
      openEditor,
      openMiss,
      openAI,
      startFocus,
      focusTaskId,
    }),
    [t, settings.lang, settings.level, view, navigate, openEditor, openMiss, openAI, startFocus, focusTaskId]
  );

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#12101c]">
        <div className="flex flex-col items-center gap-3">
          <div className="brand-grad flex h-16 w-16 items-center justify-center rounded-3xl shadow-2xl shadow-fuchsia-500/30">
            <div className="h-7 w-7 rounded-full border-[3.5px] border-white/90" />
          </div>
          <p className="text-sm font-bold text-white/90">Universal Life OS</p>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
            <div className="shimmer h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  const isMainTab = NAV.some((n) => n.view === view);

  // Qulf faol bo'lsa — asosiy kontent umuman render bo'lmaydi (DOM'da ham bo'lmaydi)
  if (isLocked && settings.lockPinHash) {
    return (
      <LockScreen
        pinHash={settings.lockPinHash}
        pinLen={settings.lockPinLen}
        lang={settings.lang}
        biometric={!!settings.lockBiometric}
        onUnlock={() => setUnlocked(true)}
      />
    );
  }

  return (
    <UlosProvider value={ctx}>
      <div className="flex min-h-screen justify-center bg-gradient-to-b from-violet-950/40 via-background to-cyan-900/20 dark:from-violet-950/60">
        <main className="relative flex min-h-screen w-full max-w-[520px] flex-col bg-background shadow-2xl">
          {/* ─── Yuqori panel ─── */}
          <header className="glass sticky top-0 z-40 border-b px-4 pt-safe">
            <div className="flex h-14 items-center gap-3">
              {isMainTab ? (
                <>
                  <span className="brand-grad flex h-8 w-8 items-center justify-center rounded-xl">
                    <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-white" />
                  </span>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold leading-none">{t("app.name")}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{t("app.offlineBadge")} · {t("app.tagline")}</p>
                  </div>
                  <button
                    onClick={() => useStore.getState().setSettings({ theme: settings.theme === "light" ? "dark" : "light" })}
                    aria-label="theme"
                    className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {settings.theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={goBack} aria-label="back" className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="flex-1 text-[15px] font-bold">{t(`more.${view === "settings" ? "settings" : view}`) || t(`nav.${view}`)}</p>
                </>
              )}
            </div>
          </header>

          {/* ─── APK yuklab olish banneri (faqat brauzerda) ─── */}
          {showApkBanner && (
            <div className="brand-grad mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-lg">
              <Download className="h-5 w-5 shrink-0" />
              <a
                href="/Universal-Life-OS-v1.8.apk"
                download="Universal-Life-OS-v1.8.apk"
                className="flex-1 text-[13px] font-semibold leading-tight"
              >
                {t("app.apkBanner")}
                <span className="block text-[11px] font-normal opacity-80">Android 7.0+ · 5 MB · bepul</span>
              </a>
              <button onClick={closeApkBanner} aria-label="close" className="rounded-lg p-1 text-white/70 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* ─── Kontent ─── */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {view === "today" && <Dashboard />}
                {view === "tasks" && <TasksView />}
                {view === "calendar" && <CalendarView />}
                {view === "goals" && <GoalsView />}
                {view === "notes" && <NotesView />}
                {view === "focus" && <FocusView />}
                {view === "finance" && <FinanceView />}
                {view === "audit" && <AuditView />}
                {view === "analytics" && <AnalyticsView />}
                {view === "alarm" && <AlarmView />}
                {view === "sleep" && <SleepView />}
                {view === "settings" && <SettingsView />}
                {view === "more" && <MoreView />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ─── Pastki panel: AI qatori + FAB + navigatsiya ─── */}
          <div className="glass sticky bottom-0 z-40 border-t px-3 pb-safe pt-2">
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={openAI}
                className="group flex flex-1 items-center gap-2.5 rounded-2xl border border-violet-500/30 bg-violet-500/[0.07] px-3.5 py-2.5 text-left transition-all active:scale-[0.99]"
              >
                <span className="brand-grad flex h-7 w-7 items-center justify-center rounded-xl text-white shadow-md shadow-violet-500/25">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-[13px] text-muted-foreground/80">{t("ai.bar")}</span>
                {/* Marshalrut atamasi — «Oddiy» darajasida yashiriladi (PRD 8) */}
                {settings.level !== "simple" && (
                  <span className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-500">
                    T4→T0
                  </span>
                )}
              </button>
              <button
                onClick={() => openEditor()}
                aria-label={t("tasks.newTask")}
                className="brand-grad flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-violet-500/30 transition-transform active:scale-90"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </div>

            <nav className="flex items-stretch justify-between gap-0.5" aria-label="main">
              {NAV.map((n) => {
                const active = view === n.view || (n.view === "more" && !isMainTab && view !== "today" && view !== "tasks" && view !== "calendar" && view !== "goals");
                return (
                  <button
                    key={n.view}
                    onClick={() => {
                      setNavHistory([]);
                      setView(n.view);
                    }}
                    className={cn(
                      "relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
                      active ? "text-violet-500" : "text-muted-foreground/70 hover:text-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-2xl bg-violet-500/[0.09]"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <n.icon className="relative h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                    <span className={cn("relative text-[9.5px] font-semibold", active && "font-bold")}>
                      {t(n.key)}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ─── Drawerlar ─── */}
          {editorOpen && <TaskEditorDrawer task={editorTask} onClose={() => setEditorOpen(false)} />}
          <MissSheet task={missTask} onClose={() => setMissTask(null)} />
          <AISheet open={aiOpen} onClose={() => setAiOpen(false)} />

          {/* ─── Zang oynasi — hammasidan ustun ─── */}
          {ringing && (
            <RingOverlay ring={ringing} t={t} onDismiss={() => dismissRing(ringing)} onSnooze={(min) => snoozeRing(ringing, min)} />
          )}
        </main>
      </div>
    </UlosProvider>
  );
}
