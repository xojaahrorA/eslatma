"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { chainHash, dateKey, pad2, uuidv7 } from "./utils-app";
import type {
  AIProposal,
  AIRecord,
  Expense,
  FinanceCategory,
  Goal,
  Habit,
  HabitLog,
  Note,
  Settings,
  Snapshot,
  Task,
  TimeEntry,
} from "./types";
import type { ParsedInput } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  lang: "uz",
  theme: "dark",
  fontScale: "normal",
  level: "active",
  aiEnabled: true,
  aiDailyLimit: 20,
  userName: "",
  focusWorkMin: 25,
  focusBreakMin: 5,
  financeBudget: 2000000,
  lockEnabled: false,
  lockPinHash: null,
  lockPinLen: null,
  lockBiometric: false,
  seeded: false,
};

interface UndoToast {
  fn: () => void;
}

interface StoreState {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  notes: Note[];
  expenses: Expense[];
  timeEntries: TimeEntry[];
  aiRecords: AIRecord[];
  aiUsageDate: string;
  aiUsageCount: number;
  settings: Settings;

  // vazifalar
  addTask: (t: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: Task["status"], missReason?: Task["missReason"]) => void;

  // odatlar
  addHabit: (h: Partial<Habit> & { title: string }) => void;
  deleteHabit: (id: string) => void;
  logHabit: (habitId: string, date: string, value: number) => void;
  getHabitValue: (habitId: string, date: string) => number;

  // maqsadlar
  addGoal: (g: Partial<Goal> & { title: string }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  bumpGoal: (id: string, delta: number) => void;

  // qaydlar
  addNote: (n: Partial<Note> & { title: string }) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  // moliya
  addExpense: (e: Partial<Expense> & { amount: number }) => void;
  deleteExpense: (id: string) => void;

  // fokus
  addTimeEntry: (e: Omit<TimeEntry, "id">) => void;

  // AI
  pushAIRecord: (command: string, proposal: AIProposal, decision: AIRecord["decision"], executedCount: number) => AIRecord;
  markAIRecordUndone: (id: string) => void;
  bumpAIUsage: () => void;

  // sozlamalar
  setSettings: (patch: Partial<Settings>) => void;

  // ma'lumot egaligi
  snapshot: () => Snapshot;
  restore: (s: Snapshot) => void;
  exportAll: () => string;
  wipeAll: () => void;
  seedDemo: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      habits: [],
      habitLogs: [],
      goals: [],
      notes: [],
      expenses: [],
      timeEntries: [],
      aiRecords: [],
      aiUsageDate: dateKey(new Date()),
      aiUsageCount: 0,
      settings: DEFAULT_SETTINGS,

      addTask: (t) => {
        const task: Task = {
          id: uuidv7(),
          title: t.title,
          notes: t.notes,
          dueAt: t.dueAt,
          hasTime: t.hasTime ?? Boolean(t.dueAt && t.dueAt.includes("T")),
          priority: t.priority ?? "medium",
          tags: t.tags ?? [],
          status: t.status ?? "todo",
          estimateMin: t.estimateMin,
          repeat: t.repeat ?? "none",
          createdAt: new Date().toISOString(),
          source: t.source ?? "user",
          evidence: t.evidence,
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task;
      },
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      setTaskStatus: (id, status, missReason) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status,
                  missReason: status === "missed" ? missReason ?? "other" : t.missReason,
                  completedAt: status === "done" ? new Date().toISOString() : t.completedAt,
                }
              : t
          ),
        })),

      addHabit: (h) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: uuidv7(),
              title: h.title,
              emoji: h.emoji ?? "✦",
              perWeek: h.perWeek ?? 7,
              color: h.color ?? "orange",
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      deleteHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          habitLogs: s.habitLogs.filter((l) => l.habitId !== id),
        })),
      logHabit: (habitId, date, value) =>
        set((s) => {
          const exists = s.habitLogs.find((l) => l.habitId === habitId && l.date === date);
          if (exists) {
            if (exists.value === value) {
              return { habitLogs: s.habitLogs.filter((l) => l !== exists) };
            }
            return {
              habitLogs: s.habitLogs.map((l) =>
                l === exists ? { ...l, value } : l
              ),
            };
          }
          return { habitLogs: [...s.habitLogs, { habitId, date, value }] };
        }),
      getHabitValue: (habitId, date) => {
        const found = get().habitLogs.find((l) => l.habitId === habitId && l.date === date);
        return found?.value ?? 0;
      },

      addGoal: (g) =>
        set((s) => ({
          goals: [
            ...s.goals,
            {
              id: uuidv7(),
              title: g.title,
              type: g.type ?? "outcome",
              target: g.target ?? 100,
              current: g.current ?? 0,
              unit: g.unit ?? "%",
              deadline: g.deadline,
              parentGoalId: g.parentGoalId,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      bumpGoal: (id, delta) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id ? { ...g, current: Math.max(0, Math.min(g.target, g.current + delta)) } : g
          ),
        })),

      addNote: (n) => {
        const note: Note = {
          id: uuidv7(),
          title: n.title,
          body: n.body ?? "",
          tags: n.tags ?? [],
          pinned: n.pinned ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
          ),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addExpense: (e) =>
        set((s) => ({
          expenses: [
            {
              id: uuidv7(),
              amount: e.amount,
              category: (e.category ?? "other") as FinanceCategory,
              note: e.note,
              date: e.date ?? dateKey(new Date()),
              createdAt: new Date().toISOString(),
            },
            ...s.expenses,
          ],
        })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      addTimeEntry: (e) =>
        set((s) => ({ timeEntries: [...s.timeEntries, { ...e, id: uuidv7() }] })),

      pushAIRecord: (command, proposal, decision, executedCount) => {
        const prev = get().aiRecords[0];
        const prevHash = prev?.hash ?? "genesis";
        const payload = JSON.stringify({ command, proposal, decision, executedCount });
        const rec: AIRecord = {
          id: uuidv7(),
          ts: new Date().toISOString(),
          command,
          proposal,
          decision,
          executedCount,
          prevHash,
          hash: chainHash(prevHash, payload),
        };
        set((s) => ({ aiRecords: [rec, ...s.aiRecords].slice(0, 200) }));
        return rec;
      },
      markAIRecordUndone: (id) =>
        set((s) => ({
          aiRecords: s.aiRecords.map((r) => (r.id === id ? { ...r, decision: "undone" } : r)),
        })),
      bumpAIUsage: () => {
        const today = dateKey(new Date());
        set((s) => ({
          aiUsageDate: today,
          aiUsageCount: s.aiUsageDate === today ? s.aiUsageCount + 1 : 1,
        }));
      },

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      snapshot: () => {
        const s = get();
        return {
          tasks: s.tasks,
          habits: s.habits,
          habitLogs: s.habitLogs,
          goals: s.goals,
          notes: s.notes,
          expenses: s.expenses,
        };
      },
      restore: (snap) => set({ ...snap }),
      exportAll: () => {
        const s = get();
        return JSON.stringify(
          {
            app: "Universal Life OS",
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: s.tasks,
            habits: s.habits,
            habitLogs: s.habitLogs,
            goals: s.goals,
            notes: s.notes,
            expenses: s.expenses,
            timeEntries: s.timeEntries,
            aiRecords: s.aiRecords,
            // AI kaliti (BYOK) eksportga KIRMAYDI — faqat qurilmada qoladi (PRD 8.3)
            settings: { ...s.settings, aiKey: undefined },
          },
          null,
          2
        );
      },
      wipeAll: () =>
        set({
          tasks: [],
          habits: [],
          habitLogs: [],
          goals: [],
          notes: [],
          expenses: [],
          timeEntries: [],
          aiRecords: [],
          aiUsageCount: 0,
          settings: { ...get().settings, seeded: true },
        }),
      seedDemo: () => seed(set, get),
    }),
    {
      name: "ulos-store-v2",
      // Xavfsiz merge: eski saqlangan holatda yangi maydonlar (masalan `level`)
      // yetishmasa — DEFAULT_SETTINGS'dan to'ldiriladi, aks holda daraja
      // "undefined" bo'lib qolib, hech qaysi tugma tanlangan ko'rinmasdi.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StoreState>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  )
);

// ─── Namuna ma'lumotlar (birinchi ishga tushishda) ──────────────────────────

function seed(
  set: (partial: Partial<StoreState>) => void,
  get: () => StoreState
) {
  const now = new Date();
  const today = dateKey(now);
  const yest = dateKey(new Date(now.getTime() - 86400000));
  const tmrw = dateKey(new Date(now.getTime() + 86400000));
  const at = (day: string, h: number, m = 0) => `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  const tasks: Task[] = [
    {
      id: uuidv7(), title: "Loyiha rejasini yozish", dueAt: at(today, 10, 0), hasTime: true,
      priority: "critical", tags: ["ish"], status: "todo", estimateMin: 90, repeat: "none",
      createdAt: new Date().toISOString(), source: "user",
    },
    {
      id: uuidv7(), title: "Django REST — API doklarini o'qish", dueAt: at(today, 14, 0), hasTime: true,
      priority: "high", tags: ["ish", "o'rganish"], status: "in_progress", estimateMin: 45, repeat: "none",
      createdAt: new Date().toISOString(), source: "user",
    },
    {
      id: uuidv7(), title: "Ingliz tili — Unit 5", dueAt: at(tmrw, 9, 0), hasTime: true,
      priority: "high", tags: ["o'qish"], status: "todo", estimateMin: 60, repeat: "none",
      createdAt: new Date().toISOString(), source: "user",
    },
    {
      id: uuidv7(), title: "Sport zal", dueAt: at(today, 18, 30), hasTime: true,
      priority: "medium", tags: ["sog'liq"], status: "todo", estimateMin: 60, repeat: "daily",
      createdAt: new Date().toISOString(), source: "user",
    },
    {
      id: uuidv7(), title: "Bozor xaridi", dueAt: at(yest, 19, 0), hasTime: true,
      priority: "medium", tags: ["uy"], status: "missed", missReason: "no_time", estimateMin: 40, repeat: "none",
      createdAt: new Date().toISOString(), source: "user",
    },
    {
      id: uuidv7(), title: "«Deep Work» — 20 bet", hasTime: false,
      priority: "low", tags: ["o'qish"], status: "todo", estimateMin: 30, repeat: "none",
      createdAt: new Date().toISOString(), source: "user",
    },
  ];

  const habits: Habit[] = [
    { id: uuidv7(), title: "Suv ichish", emoji: "💧", perWeek: 7, color: "teal", createdAt: new Date().toISOString() },
    { id: uuidv7(), title: "Kitob o'qish", emoji: "📖", perWeek: 5, color: "violet", createdAt: new Date().toISOString() },
    { id: uuidv7(), title: "Yugurish", emoji: "🏃", perWeek: 3, color: "orange", createdAt: new Date().toISOString() },
  ];

  const habitLogs: HabitLog[] = [
    { habitId: habits[0].id, date: yest, value: 1 },
    { habitId: habits[0].id, date: today, value: 1 },
    { habitId: habits[1].id, date: yest, value: 1 },
    { habitId: habits[2].id, date: yest, value: 0.5 },
  ];

  const goals: Goal[] = [
    { id: uuidv7(), title: "Ingliz tilini B2 darajaga olib chiqish", type: "outcome", target: 12, current: 5, unit: "modul", deadline: `${now.getFullYear()}-12-31`, createdAt: new Date().toISOString() },
    { id: uuidv7(), title: "Haftada 3 marta sport", type: "process", target: 12, current: 7, unit: "marta", createdAt: new Date().toISOString() },
    { id: uuidv7(), title: "Ijtimoiy tarmoq — kuniga ≤ 1 soat", type: "boundary", target: 30, current: 18, unit: "kun", createdAt: new Date().toISOString() },
  ];

  const notes: Note[] = [
    {
      id: uuidv7(), title: "Kunlik refleks shabloni", pinned: true,
      body: "1-savol: Bugun eng muhim ishim nima bo'ldi?\n2-savol: Nimagaydi to'sqinlik qildi?\n3-savol: Ertaga bitta kichik qadam — nima?\n\nBog'liq: [[Universal AI Gateway g'oyalari]]",
      tags: ["shablon", "refleks"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: uuidv7(), title: "Universal AI Gateway g'oyalari", pinned: false,
      body: "• T0 — AI'siz qoidalar dvigateli, doim yoqiq\n• Lite modelga grammatik cheklangan JSON\n• Permission Engine — KIM × NIMA × QANDAY\n• Copy-Paste Bridge — kalitsiz ulanish\n\n[[Kunlik refleks shabloni]] bilan kechki 5 daqiqada ko'rib chiqish.",
      tags: ["ai", "loyiha"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: uuidv7(), title: "Django: middleware qisqacha", pinned: false,
      body: "Request → middlewarelar zanjiri → view → response.\nCustom middleware: factory(call_get_response) pattern.\nAudit uchun logging middleware yozish kerak.",
      tags: ["texnika"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ];

  const expenses: Expense[] = [
    { id: uuidv7(), amount: 28000, category: "food", note: "Tushlik", date: today, createdAt: new Date().toISOString() },
    { id: uuidv7(), amount: 6000, category: "transport", note: "Metro", date: today, createdAt: new Date().toISOString() },
    { id: uuidv7(), amount: 145000, category: "home", note: "Oziq-ovqat", date: yest, createdAt: new Date().toISOString() },
    { id: uuidv7(), amount: 90000, category: "fun", note: "Kino", date: yest, createdAt: new Date().toISOString() },
  ];

  const timeEntries: TimeEntry[] = [
    { id: uuidv7(), taskId: tasks[0].id, label: tasks[0].title, start: `${today}T09:00`, end: `${today}T10:05`, mode: "focus" },
    { id: uuidv7(), taskId: tasks[1].id, label: tasks[1].title, start: `${today}T14:00`, end: `${today}T14:50`, mode: "focus" },
  ];

  // ── Tarix: 90 kunlik realistik izlar — Analitika jonli ko'rinishi uchun ──
  const HIST_TITLES = [
    "Ingliz tili darsi", "Sport zal", "Loyiha bilan ish", "Kod yozish",
    "Kitob o'qish", "Uy ishlari", "Bozorlik", "Dars tayyorlash",
    "Yugurish", "Blog post yozish", "Moliyani ko'rib chiqish", "Oilaviy uchrashuv",
  ];
  const HIST_TAGS = ["ish", "o'rganish", "sog'liq", "uy", "shaxsiy"];
  const HIST_STATUSES = ["done", "done", "done", "done", "done", "missed", "cancelled"] as const;
  const HIST_REASONS = ["no_time", "no_time", "sick", "priority_changed"] as const;
  const HIST_PRIO = ["high", "medium", "medium", "medium", "low", "critical"] as const;
  const HIST_EST = [15, 25, 30, 45, 60, 90];
  const HIST_CATS: FinanceCategory[] = ["food", "transport", "fun", "home", "health", "other"];
  const CAT_RANGE: Record<FinanceCategory, [number, number]> = {
    food: [8_000, 65_000],
    transport: [3_000, 14_000],
    fun: [15_000, 120_000],
    home: [40_000, 260_000],
    health: [10_000, 150_000],
    other: [10_000, 80_000],
  };
  const HIST_NOTES: { title: string; body: string; daysAgo: number }[] = [
    {
      title: "Chorak yakuniy mulohaza",
      body: "Bu chorakda eng katta yutuq — muntazamlik. Kichik qadamlar katta natijaga olib keladi.",
      daysAgo: 78,
    },
    {
      title: "Kitobdan g'oyalar: «Atomic Habits»",
      body: "• 2 daqiqalik qoida — yangi odatni kichikdan boshlash\n• Muhit dizayni — odatni osonlashtirish\n• Zanjirni buzmaslik eng muhimi",
      daysAgo: 41,
    },
    {
      title: "Fokus eksperimenti: ertalabki bloklar",
      body: "Ertalab 9–11 fokus bloklari kechqurunga qaraganda 2x samarali ekan. Shu ritmni saqlash kerak.",
      daysAgo: 16,
    },
  ];

  const histTasks: Task[] = [];
  const histLogs: HabitLog[] = [];
  const histExp: Expense[] = [];
  const histTime: TimeEntry[] = [];

  for (let i = 90; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    const dk = dateKey(d);

    // vazifalar: ish kunlari 1–3 ta, dam olish 0–1 ta
    const nT = weekend ? Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < nT; j++) {
      const st = HIST_STATUSES[Math.floor(Math.random() * HIST_STATUSES.length)];
      const hasTime = Math.random() < 0.7;
      const h = 9 + Math.floor(Math.random() * 10);
      histTasks.push({
        id: uuidv7(),
        title: HIST_TITLES[Math.floor(Math.random() * HIST_TITLES.length)],
        dueAt: hasTime ? `${dk}T${pad2(h)}:${Math.random() < 0.5 ? "00" : "30"}` : undefined,
        hasTime,
        priority: HIST_PRIO[Math.floor(Math.random() * HIST_PRIO.length)],
        tags: [HIST_TAGS[Math.floor(Math.random() * HIST_TAGS.length)]],
        status: st,
        missReason: st === "missed" ? HIST_REASONS[Math.floor(Math.random() * HIST_REASONS.length)] : undefined,
        estimateMin: HIST_EST[Math.floor(Math.random() * HIST_EST.length)],
        repeat: "none",
        createdAt: `${dk}T08:00`,
        completedAt: st === "done" ? `${dk}T${pad2(Math.min(21, h + 1 + Math.floor(Math.random() * 3)))}:30` : undefined,
        source: "user",
      });
    }

    // odatlar: suv 78%, kitob 55%, yugurish 30%
    const hp: [number, number][] = [[0, 0.78], [1, 0.55], [2, 0.3]];
    for (const [hi, p] of hp) {
      const r = Math.random();
      if (r < p) {
        histLogs.push({ habitId: habits[hi].id, date: dk, value: hi === 2 && r > p * 0.75 ? 0.5 : 1 });
      }
    }

    // xarajatlar: kunlarning ~55%ida 1–2 ta yozuv
    if (Math.random() < 0.55) {
      const nE = Math.random() < 0.25 ? 2 : 1;
      for (let j = 0; j < nE; j++) {
        const cat = HIST_CATS[Math.floor(Math.random() * HIST_CATS.length)];
        const [lo, hi2] = CAT_RANGE[cat];
        histExp.push({
          id: uuidv7(),
          amount: Math.round((lo + Math.random() * (hi2 - lo)) / 1000) * 1000,
          category: cat,
          date: dk,
          createdAt: `${dk}T20:00`,
        });
      }
    }

    // fokus sessiyalari: ish kunlarida 45% ehtimol bilan 1–2 sessiya
    if (!weekend && Math.random() < 0.45) {
      const nF = Math.random() < 0.3 ? 2 : 1;
      for (let j = 0; j < nF; j++) {
        const sh = 9 + Math.floor(Math.random() * 9);
        const dur = [25, 35, 50][Math.floor(Math.random() * 3)];
        histTime.push({
          id: uuidv7(),
          label: "Fokus sessiya",
          start: `${dk}T${pad2(sh)}:00`,
          end: `${dk}T${pad2(sh)}:${pad2(dur)}`,
          mode: "focus",
        });
      }
    }
  }

  // eski qaydlar — yillik hisobotga hayot qo'shadi
  const oldNotes: Note[] = HIST_NOTES.map((hn) => {
    const cd = new Date(now);
    cd.setDate(cd.getDate() - hn.daysAgo);
    const ciso = cd.toISOString();
    return {
      id: uuidv7(),
      title: hn.title,
      body: hn.body,
      tags: ["mulohaza"],
      pinned: false,
      createdAt: ciso,
      updatedAt: ciso,
    };
  });

  set({
    tasks: [...histTasks, ...tasks],
    habits,
    habitLogs: [...histLogs, ...habitLogs],
    goals,
    notes: [...oldNotes, ...notes],
    expenses: [...histExp, ...expenses],
    timeEntries: [...histTime, ...timeEntries],
    settings: { ...get().settings, seeded: true },
  });
}

export type { ParsedInput };
