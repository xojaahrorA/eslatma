/**
 * ─── Universal AI Gateway — umumiy shartnoma (PRD 5-bo'lim) ──────────────────
 * Server route (bulut T4) va mijozdagi BYOK chaqiruvi BIR XIL prompt va
 * BIR XIL validatsiyadan foydalanadi — natija doim bashoratlanadigan JSON.
 */

export interface GatewayAction {
  action: string;
  params: Record<string, unknown>;
  reason: string;
  confidence: number;
}

export interface GatewayProposal {
  summary: string;
  actions: GatewayAction[];
  conflicts: { with: string; resolution: string }[];
  model: { provider: string; class: string };
  data_used: string[];
}

export const ACTION_SCHEMA = `
{
  "summary": "short human summary of the proposal",
  "actions": [
    {
      "action": "task.create" | "task.reschedule" | "task.complete" | "note.create" | "plan.propose" | "summary.create",
      "params": { ... },
      "reason": "why this action is proposed, same language as user command",
      "confidence": 0.0..1.0
    }
  ],
  "data_used": ["context:data", "tasks:today", ...],
  "model": { "provider": "cloud-t4", "class": "Pro" }
}
`;

export const PARAM_DOCS = `
- task.create params: { title: string, due_at?: "YYYY-MM-DDTHH:mm" (local time), priority?: "critical"|"high"|"medium"|"low", tags?: string[], estimate_min?: number }
- task.reschedule params: { task_id: string (MUST be an id from provided tasks), new_due_at: "YYYY-MM-DDTHH:mm" }
- task.complete params: { task_id: string (MUST be from provided tasks) }
- note.create params: { title: string, body: string, tags?: string[] }
- plan.propose params: { text: string } (a plan written in the user's language)
- summary.create params: { text: string } (a summary written in the user's language)
Rules:
- Return STRICT JSON only. No markdown, no code fences, no comments.
- Max 5 actions. Never invent task_id values — only use ids from the context.
- Today's date and current time are provided; resolve relative dates ("tomorrow", "next monday") against them.
- If the command is a question, use summary.create with the answer text.
`;

const LANG_INSTRUCTION: Record<string, string> = {
  uz: "Write 'summary', 'reason' and text params in Uzbek (Latin).",
  ru: "Write 'summary', 'reason' and text params in Russian.",
  en: "Write 'summary', 'reason' and text params in English.",
};

export interface GatewayContext {
  today: string;
  now: string;
  tasks: { id: string; title: string; due: string | null }[];
  habits: string[];
  goals: { title: string; progress: string }[];
}

export function buildGatewayMessages(command: string, lang: string, ctx: GatewayContext) {
  return [
    {
      role: "system" as const,
      content: `You are the Universal AI Gateway inside "Universal Life OS" — a personal life-management app. You convert the user's natural command into typed, validated ACTIONS (never free-form chatter). ${LANG_INSTRUCTION[lang] ?? ""} ${ACTION_SCHEMA} ${PARAM_DOCS}`,
    },
    {
      role: "user" as const,
      content: `Today: ${ctx.today}\nCurrent time: ${ctx.now}\nUpcoming tasks (id, title, due): ${JSON.stringify(
        (ctx.tasks ?? []).slice(0, 15)
      )}\nHabits: ${JSON.stringify((ctx.habits ?? []).slice(0, 10))}\nGoals: ${JSON.stringify(
        (ctx.goals ?? []).slice(0, 10)
      )}\n\nUser command: ${command}`,
    },
  ];
}

/** Model javobidan qat'iy JSON'ni chiqarish (``` belgilari bilan ham ishlaydi) */
export function extractJson(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

const VALID_ACTIONS = [
  "task.create",
  "task.reschedule",
  "task.complete",
  "note.create",
  "plan.propose",
  "summary.create",
];

/** 4 bosqichli tekshiruv (PRD 6.1): faqat ma'lum amallar, max 5, ishonch 0..1 */
export function validateProposal(parsed: Record<string, unknown>, provider: string): GatewayProposal | null {
  if (!parsed || !Array.isArray(parsed.actions)) return null;
  const actions = (parsed.actions as Record<string, unknown>[])
    .filter((a) => VALID_ACTIONS.includes(String(a.action)))
    .slice(0, 5)
    .map((a) => ({
      action: String(a.action),
      params: (a.params ?? {}) as Record<string, unknown>,
      reason: String(a.reason ?? ""),
      confidence: Math.max(0, Math.min(1, Number(a.confidence ?? 0.7))),
    }));

  if (actions.length === 0) {
    const summaryText = typeof parsed.summary === "string" ? parsed.summary : "";
    actions.push({
      action: "summary.create",
      params: { text: summaryText },
      reason: "Command was informational — returned as text answer",
      confidence: 0.6,
    });
  }

  return {
    summary: String(parsed.summary ?? ""),
    actions,
    conflicts: [],
    model: { provider, class: String((parsed.model as Record<string, unknown>)?.class ?? "Standard") },
    data_used: Array.isArray(parsed.data_used)
      ? (parsed.data_used as unknown[]).map(String).slice(0, 8)
      : ["tasks:context"],
  };
}

// ─── BYOK providerlar (OpenAI-mos endpointlar) ───────────────────────────────

export interface ProviderPreset {
  id: "deepseek" | "openrouter" | "gemini" | "zai" | "custom";
  baseUrl: string;
  model: string;
  keyHint: string;
}

export const PROVIDERS: ProviderPreset[] = [
  { id: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", keyHint: "sk-…" },
  { id: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", keyHint: "sk-or-…" },
  { id: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", keyHint: "AIza…" },
  { id: "zai", baseUrl: "https://api.z.ai/api/paas/v4", model: "glm-4.5-flash", keyHint: "…" },
  { id: "custom", baseUrl: "", model: "", keyHint: "sk-…" },
];

export const byokReady = (s: {
  aiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
}): boolean => !!(s.aiKey && s.aiBaseUrl && s.aiModel);

/**
 * OpenAI-mos chat/completions chaqiruvi (mijozdan to'g'ridan-to'g'ri).
 * Kalit hech qanday logga yozilmaydi; xato faqat matn sifatida qaytadi.
 */
export async function callByok(opts: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: { role: string; content: string }[];
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  try {
    const url = `${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}${t ? `: ${t.slice(0, 140)}` : ""}` };
    }
    const data = await res.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";
    if (!content) return { ok: false, error: "empty_response" };
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}
