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
  seeded?: boolean;
}

export interface Snapshot {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  notes: Note[];
  expenses: Expense[];
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
