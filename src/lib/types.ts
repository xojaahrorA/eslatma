// ─── Universal Life OS — umumiy tiplar ───────────────────────────────────────
// PRD v2.0 asosida: 10-bo'lim (Ma'lumotlar modeli) mantiqiy xaritasi.

export type Lang = "uz" | "ru" | "en";
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "done"
  | "deferred"
  | "cancelled"
  | "missed";
export type MissReason =
  | "no_time"
  | "sick"
  | "priority_changed"
  | "not_needed"
  | "other";
export type GoalType = "outcome" | "process" | "boundary";
export type ExperienceLevel = "simple" | "active" | "power" | "dev";
export type ThemeMode = "light" | "dark" | "amoled";
export type FontScale = "small" | "normal" | "large";
export type TaskSource = "user" | "ai" | "t0" | "import";
export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "every3d";

/**
 * Budilnik missiyasi turlari — Mission Alarm uslubi (v1.8).
 * Zang oynasi "To'xtatish" tugmasi barcha missiyalar bajarilguncha yopilmaydi.
 *  — math:   matematik misol (qiyinlikka qarab)
 *  — memory: ketma-ketlikni eslab, xuddi shu tartibda bosish
 *  — typing: ko'rsatilgan iborani aynan yozib berish
 *  — shake:  telefonni N marta silkitish (akselerometr)
 *  — motion: turib N qadam yurish (akselerometr to'lqinlari)
 */
export type MissionType = "math" | "memory" | "typing" | "shake" | "motion";
export type MissionDifficulty = "easy" | "medium" | "hard";

/** Budilnik bo'yicha uyg'onish statistikasi — zang natijasidan avtomatik yig'iladi */
export interface AlarmStat {
  /** Ketma-ket o'z vaqtida o'chirishlar — snooze qilinsa nolga tushadi */
  streak: number;
  total: number;
  snoozes: number;
  last: "win" | "snooze";
  lastAt: string;
}

/**
 * Budilnik — mahalliy, oflayn. time = "HH:mm" (floating),
 * days: 0=yakshanba … 6=shanba; bo'sh massiv = bir marta.
 * challenge=true bo'lsa — o'chirish uchun missiyalar yechiladi
 * (bosib o'chib bo'lmaydi — PRD talabi: bajargandan keyin o'chadi).
 * Eski ma'lumotlarda missions bo'lmasa — challenge=true → ["math"] deb olinadi.
 */
export interface Alarm {
  id: string;
  time: string; // "HH:mm"
  days: number[];
  label?: string;
  enabled: boolean;
  /** Eski maydon (moslashuvchanlik uchun saqlanadi): topshiriqli o'chirish yoqiqmi */
  challenge: boolean;
  /** Missiya zanjiri (1..4) — ketma-ket bajariladi */
  missions?: MissionType[];
  /** Qiyinlik darajasi — aqili rejimda zang vaqtida avtomatik oshishi mumkin */
  difficulty?: MissionDifficulty;
  /** Aqili rejim: missiya tartibi har zangda aralashadi, qiyinlik moslashadi,
   *  yotish eslatmasi budilnik vaqtidan avtomatik hisoblanadi */
  smart?: boolean;
  /** Snooze soni cheklovi: null = cheklovsiz, 0 = snooze yo'q, N = shuncha marta */
  snoozeLimit?: number | null;
  /** Snooze davomiyligi (daqiqa) */
  snoozeMin?: number;
  /** Yengil uyg'otish — zang ovozi asta-sekin kuchayadi */
  gentle?: boolean;
  createdAt: string;
}

/** Uyqu sessiyasi — to'liq qurilmada saqlanadi */
export interface SleepSession {
  id: string;
  start: string; // ISO mahalliy
  end: string;   // ISO mahalliy
  /** Uxlashga ketgan vaqt (daqiqa) — qo'lda yoki taxminiy */
  latencyMin?: number;
  /** Tunda uyg'onishlar soni (qo'lda) */
  wakings?: number;
  /** Foydalanuvchi bahosi 1..5 */
  quality?: number;
  /** Har daqiqalik harakat indeksi 0..100 (sensor rejimi) — ixchiroiy */
  motion?: number[];
  /** Akselerometr sensori bilan yig'ilganmi */
  sensor?: boolean;
  /** Tahlil natijasi (daqiqalarda) */
  stages?: SleepStages;
  /** Uyqu ballari 0..100 */
  score?: number;
  note?: string;
}

export interface SleepStages {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}

/**
 * Zang vaqti kutilayotgan yoki kelgan signal.
 * key: "alarm:{alarmId}:{atTs}" yoki "task:{taskId}:{atTs}"
 */
export interface PendingRing {
  key: string;
  kind: "alarm" | "task";
  title: string;
  /** Qo'shimcha matn (masalan, aniq vaqt) */
  body?: string;
  /** ISO mahalliy — signal chalinadigan vaqt */
  at: string;
  /** O'chirish uchun topshiriq kerakmi (eski maydon — missions bilan birga ishlaydi) */
  challenge: boolean;
  /** Missiya zanjiri (bo'sh/yo'q bo'lsa challenge=true → ["math"]) */
  missions?: MissionType[];
  /** Qiyinlik darajasi */
  difficulty?: MissionDifficulty;
  /** Aqili rejim — zang vaqtida moslashuvchan qiyinlik + tartib aralashtirish */
  smart?: boolean;
  /** Snooze cheklovi: null = cheklovsiz, 0 = yo'q, N = shuncha marta */
  snoozeLimit?: number | null;
  /** Snooze davomiyligi (daqiqa) */
  snoozeMin?: number;
  /** Shu zangda hozirgacha nech marta snooze bosilgan */
  snoozeUsed?: number;
  /** Yengil uyg'otish — ovoz asta-sekin kuchayadi */
  gentle?: boolean;
  /** Bir marta (takrorlanmaydigan budilnik) — o'chirilganda disable bo'ladi */
  once?: boolean;
  /** Qaysi budilnik (kind=alarm) */
  alarmId?: string;
  /** Takrorlanish kunlari (kind=alarm) — keyingi jadval uchun */
  days?: number[];
  /** Budilnik vaqti "HH:mm" (keyingi jadval uchun) */
  time?: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** ISO mahalliy vaqt: yyyy-MM-dd'T'HH:mm (floating — vaqt zonasiga bog'liq) */
  dueAt?: string;
  hasTime?: boolean;
  priority: Priority;
  tags: string[];
  status: TaskStatus;
  missReason?: MissReason;
  estimateMin?: number;
  actualMin?: number;
  repeat: Repeat;
  createdAt: string;
  completedAt?: string;
  source: TaskSource;
  /** AI taklifini qabul qilganda qaysi ma'lumot asosida yaratilgani (shaffoflik) */
  evidence?: string[];
  /** Budilnik kabi signal: to'liq ovoz + o'chirmaslik uchun topshiriq (PRD 4.7) */
  alarmLike?: boolean;
}

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  perWeek: number; // 7 = har kuni
  color: HabitColor;
  createdAt: string;
  archived?: boolean;
}

export type HabitColor = "orange" | "violet" | "teal" | "rose" | "lime";

/** Odat jurnali: date = yyyy-MM-dd, value: 1 = bajarildi, 0.5 = tiklanish kuni */
export interface HabitLog {
  habitId: string;
  date: string;
  value: number;
}

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  target: number;
  current: number;
  unit?: string;
  deadline?: string; // yyyy-MM-dd
  parentGoalId?: string;
  createdAt: string;
  archived?: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: FinanceCategory;
  note?: string;
  date: string; // yyyy-MM-dd
  createdAt: string;
}

export type FinanceCategory =
  | "food"
  | "transport"
  | "home"
  | "health"
  | "fun"
  | "other";

export interface TimeEntry {
  id: string;
  taskId?: string;
  label: string;
  start: string; // ISO
  end: string; // ISO
  mode: "focus" | "break";
}

// ─── AI Gateway tiplari (PRD 5.6 / 6.1 sxemasi) ─────────────────────────────

export type AIActionName =
  | "task.create"
  | "task.reschedule"
  | "task.complete"
  | "note.create"
  | "plan.propose"
  | "summary.create";

export interface AIProposalAction {
  action: AIActionName;
  params: Record<string, unknown>;
  reason: string;
  confidence: number; // 0..1
}

export interface AIProposal {
  proposal_id: string;
  summary: string;
  actions: AIProposalAction[];
  conflicts: { with: string; resolution: string }[];
  model: { provider: string; class: string };
  data_used: string[];
  requires_approval: boolean;
}

export type AIDecision = "approved" | "rejected" | "undone";

/** Audit jurnali yozuvi — append-only, xesh zanjir bilan (PRD 7.3) */
export interface AIRecord {
  id: string;
  ts: string;
  command: string;
  proposal: AIProposal;
  decision: AIDecision;
  executedCount: number;
  prevHash: string;
  hash: string;
}

export interface Settings {
  lang: Lang;
  theme: ThemeMode;
  fontScale: FontScale;
  level: ExperienceLevel;
  aiEnabled: boolean;
  aiDailyLimit: number;
  userName: string;
  focusWorkMin: number;
  focusBreakMin: number;
  financeBudget: number;
  /** Ekran qulfi: PIN sha-256 hash ko'rinishida saqlanadi (ochiq matn EMAS) */
  lockEnabled: boolean;
  lockPinHash: string | null;
  /** PIN uzunligi — shuncha raqam kirtilganda avtomatik tekshirish uchun */
  lockPinLen: number | null;
  /** Barmoq izi / yuz bilan ochish (faqat APK'da, qurilma qo'llasa) */
  lockBiometric?: boolean;
  /**
   * O'z AI kaliti (BYOK — PRD 5.4 qo'shimcha). Faqat qurilmada saqlanadi,
   * eksportga KIRMAYDI. Ishlashi uchun OpenAI-mos endpoint kerak.
   */
  aiProvider?: "deepseek" | "openrouter" | "gemini" | "zai" | "custom";
  aiBaseUrl?: string;
  aiModel?: string;
  aiKey?: string;
  /** Bildirishnomalar — lokal eslatmalar (faqat qurilmada rejalashadi) */
  notifTasks?: boolean;
  /** Vazifa boshlanishidan oldin necha daqiqa xabar berish */
  notifBeforeMin?: number;
  /** Har kuni odatlarni belgilash eslatmasi — "HH:mm" yoki null */
  notifHabitTime?: string | null;
  /** Har kuni ertalabki reja eslatmasi — "HH:mm" yoki null */
  notifMorningTime?: string | null;
  // ─── Uyqu (PRD 4.7 qo'shimchasi) ───
  /** Kunlik uyqu maqsadi (soat) — tahlil va qarz hisobi uchun */
  sleepGoalH?: number;
  /** Yotish eslatmasi — "HH:mm" yoki null */
  sleepBedtime?: string | null;
  /** Yotish eslatmasi oldidan ogohlantirish (daqiqa) */
  sleepWindMin?: number;
  seeded?: boolean;
}

export interface Snapshot {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  notes: Note[];
  expenses: Expense[];
  timeEntries?: TimeEntry[];
}

/** T0 dvigateli natijasi — AI'siz tezkor kiritish tahlili (PRD 5.2 / 4.1) */
export interface ParsedInput {
  title: string;
  dueAt?: string;
  hasTime: boolean;
  priority?: Priority;
  tags: string[];
  repeat?: Repeat;
  estimateMin?: number;
  matched: { type: string; label: string }[];
}
