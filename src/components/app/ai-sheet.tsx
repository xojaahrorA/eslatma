"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos } from "./kit";
import { t0ProposalFromCommand } from "@/lib/t0";
import { buildGatewayMessages, callByok, byokReady, extractJson, validateProposal } from "@/lib/ai-gateway";
import { inApk as nativeApk } from "@/lib/biometric";
import { fmtShortDate, parseLocal, riskLevelOf } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import type { AIProposal, Task } from "@/lib/types";
import { motion } from "framer-motion";
import {
  Bot,
  Check,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Cloud,
  Cpu,
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Route,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

const STEPS = [
  { key: "intent", icon: ScanSearch },
  { key: "context", icon: Eye },
  { key: "model", icon: Route },
  { key: "validate", icon: ScanSearch },
  { key: "permission", icon: ShieldCheck },
  { key: "execute", icon: Zap },
];

/** Inson o'qiydigan amal tavsifi */
function describeAction(a: { action: string; params: Record<string, unknown> }, lang: string): string[] {
  const p = a.params;
  const lines: string[] = [];
  const d = (iso?: string) => {
    if (!iso) return "";
    const dt = parseLocal(iso);
    if (!dt) return String(iso);
    return `${fmtShortDate(dt, lang === "ru" ? "ru" : lang === "en" ? "en" : "uz")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };
  if (typeof p.title === "string") lines.push(p.title);
  if (typeof p.due_at === "string") lines.push("⏰ " + d(p.due_at));
  if (typeof p.new_due_at === "string") lines.push("→ " + d(p.new_due_at));
  if (typeof p.priority === "string") lines.push("! " + p.priority);
  if (Array.isArray(p.tags) && p.tags.length) lines.push((p.tags as string[]).map((t) => "#" + t).join(" "));
  if (typeof p.estimate_min === "number") lines.push(p.estimate_min + "m");
  if (typeof p.text === "string") lines.push(p.text.slice(0, 160));
  return lines;
}

export default function AISheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, level } = useUlos();
  const settings = useStore((s) => s.settings);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const goals = useStore((s) => s.goals);
  const aiUsageCount = useStore((s) => s.aiUsageCount);
  const bumpAIUsage = useStore((s) => s.bumpAIUsage);
  const pushAIRecord = useStore((s) => s.pushAIRecord);
  const markAIRecordUndone = useStore((s) => s.markAIRecordUndone);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const addNote = useStore((s) => s.addNote);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);

  const [command, setCommand] = useState("");
  const [phase, setPhase] = useState<"input" | "loading" | "proposal" | "done">("input");
  const [step, setStep] = useState(0);
  const [proposal, setProposal] = useState<AIProposal | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [textAnswer, setTextAnswer] = useState<string | null>(null);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const [bridgePrompt, setBridgePrompt] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState(false);

  const limitReached = aiUsageCount >= settings.aiDailyLimit;
  const aiBlocked = !settings.aiEnabled || limitReached;
  // Eslatma: "Capacitor" in window brauzerda ham true bo'lishi mumkin (@capacitor/core
  // global obyekt yaratadi) — shuning uchun isNativePlatform() majburiy (PRD 8.3)
  const inApk = nativeApk();
  const byokActive = byokReady(settings);

  const examples = [t("ai.ex1"), t("ai.ex2"), t("ai.ex3")];

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((x) => x.status !== "done" && x.status !== "cancelled")
        .slice(0, 15)
        .map((x) => ({ id: x.id, title: x.title, due: x.dueAt ?? null })),
    [tasks]
  );

  const buildContext = () => ({
    today: new Date().toISOString().slice(0, 10),
    now: new Date().toTimeString().slice(0, 5),
    tasks: todayTasks,
    habits: habits.map((h) => h.title),
    goals: goals.map((g) => ({ title: g.title, progress: `${g.current}/${g.target}` })),
  });

  // ─── Copy-Paste Bridge (PRD 5.2): kalitsiz, ro'yxatdan o'tishsiz ──────────
  const buildBridgePrompt = () => {
    const sanitized = {
      today: buildContext().today,
      open_tasks: todayTasks.map((x) => ({ id: x.id, title: x.title, due: x.due })), // maxfiy maydonlar olib tashlangan
      habits: habits.map((h) => h.title),
    };
    setBridgePrompt(
      `You are a task planning assistant. Today: ${sanitized.today}. Respond with STRICT JSON only:\n{"summary":"...","actions":[{"action":"task.create|plan.propose|summary.create","params":{...},"reason":"...","confidence":0..1}],"data_used":[]}\ntask.create params: {title, due_at: "YYYY-MM-DDTHH:mm", priority: "critical|high|medium|low", tags: []}.\nContext (sanitized): ${JSON.stringify(sanitized)}\n\nCommand: ${command}`
    );
  };

  const runAI = async (cmdOverride?: string) => {
    const cmd = (cmdOverride ?? command).trim();
    if (!cmd) return;

    // Kill Switch — barcha bulut AI so'rovlari to'xtaydi (PRD 7.2)
    if (aiBlocked) {
      const p = t0ProposalFromCommand(cmd, lang, { openTasks: todayTasks }) as AIProposal;
      p.proposal_id = `t0-${Date.now()}`;
      setIsFallback(true);
      setProposal(p);
      setPhase("proposal");
      return;
    }

    setPhase("loading");
    setStep(0);
    const stepTimer = setInterval(() => setStep((s) => (s < 5 ? s + 1 : s)), 550);

    // ─── Zaxira zanjiri (PRD 8.3): bulut → o'z kalit (BYOK) → T0 ────────────
    const byok = byokActive ? { baseUrl: settings.aiBaseUrl!, model: settings.aiModel!, apiKey: settings.aiKey! } : null;
    let ok = false;

    // 1) O'z AI kaliti — APK'da yagona bulut yo'li, saytda bulut o'lganda zaxira
    const tryByok = async () => {
      if (!byok) return false;
      const r = await callByok({
        baseUrl: byok.baseUrl,
        model: byok.model,
        apiKey: byok.apiKey,
        messages: buildGatewayMessages(cmd, lang, buildContext()),
      });
      if (!r.ok) return false;
      const parsed = extractJson(r.content);
      const p = parsed ? validateProposal(parsed, "byok") : null;
      if (!p) return false;
      setProposal({ ...p, proposal_id: `byok-${Date.now()}`, requires_approval: true } as AIProposal);
      setIsFallback(false);
      bumpAIUsage();
      return true;
    };

    // 2) Serverdagi bulut modeli (T4) — faqat sayt versiyasida
    const tryServer = async () => {
      try {
        const res = await fetch("/api/ai/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: cmd, lang, context: buildContext() }),
        });
        const data = await res.json();
        if (data.ok && data.proposal) {
          const p: AIProposal = {
            ...data.proposal,
            proposal_id: `gw-${Date.now()}`,
            requires_approval: true,
          };
          setProposal(p);
          setIsFallback(false);
          bumpAIUsage();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    if (inApk) {
      // APK: server yo'q — faqat o'z kalit bilan to'g'ridan-to'g'ri (PRD 8.3)
      ok = await tryByok();
    } else {
      ok = await tryServer();
      if (!ok) ok = await tryByok();
    }

    clearInterval(stepTimer);

    if (!ok) {
      // Zaxira zanjiri oxiri: T0 qoidalar dvigateli
      const p = t0ProposalFromCommand(cmd, lang, { openTasks: todayTasks }) as AIProposal;
      p.proposal_id = `t0-${Date.now()}`;
      setIsFallback(true);
      setProposal(p);
    }
    setPhase("proposal");
  };

  const runFromBridgePaste = () => {
    try {
      const start = pasteText.indexOf("{");
      const end = pasteText.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no json");
      const parsed = JSON.parse(pasteText.slice(start, end + 1));
      if (!Array.isArray(parsed.actions)) throw new Error("no actions");
      const p: AIProposal = {
        proposal_id: `bridge-${Date.now()}`,
        summary: String(parsed.summary ?? ""),
        actions: parsed.actions.slice(0, 5).map((a: Record<string, unknown>) => ({
          action: String(a.action ?? "plan.propose"),
          params: (a.params ?? {}) as Record<string, unknown>,
          reason: String(a.reason ?? ""),
          confidence: Math.min(1, Math.max(0, Number(a.confidence ?? 0.6))),
        })),
        conflicts: [],
        model: { provider: "manual-bridge", class: "Standard" },
        data_used: ["bridge:pasted", "sanitized:true"],
        requires_approval: true,
      };
      setProposal(p);
      setIsFallback(false);
      setPhase("proposal");
      setBridgeOpen(false);
    } catch {
      setPasteError(true);
    }
  };

  /** Amallarni bajarish — har biri audit jurnaliga yoziladi (PRD 6) */
  const execute = () => {
    if (!proposal) return;
    const snap = snapshot();
    let executed = 0;
    const undoable: Task[] = [];
    for (const a of proposal.actions) {
      const p = a.params;
      switch (a.action) {
        case "task.create": {
          if (typeof p.title === "string" && p.title.trim()) {
            const created = addTask({
              title: p.title,
              dueAt: typeof p.due_at === "string" ? p.due_at : undefined,
              hasTime: typeof p.due_at === "string" && p.due_at.includes("T"),
              priority: (["critical", "high", "medium", "low"].includes(String(p.priority)) ? p.priority : "medium") as Task["priority"],
              tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
              estimateMin: typeof p.estimate_min === "number" ? p.estimate_min : undefined,
              source: "ai",
              evidence: proposal.data_used,
            });
            undoable.push(created);
            executed++;
          }
          break;
        }
        case "task.reschedule": {
          const tid = String(p.task_id ?? "");
          if (tasks.some((x) => x.id === tid) && typeof p.new_due_at === "string") {
            updateTask(tid, { dueAt: p.new_due_at, hasTime: p.new_due_at.includes("T") });
            executed++;
          }
          break;
        }
        case "task.complete": {
          const tid = String(p.task_id ?? "");
          if (tasks.some((x) => x.id === tid)) {
            setTaskStatus(tid, "done");
            executed++;
          }
          break;
        }
        case "note.create": {
          if (typeof p.title === "string" && p.title.trim()) {
            addNote({
              title: p.title,
              body: typeof p.body === "string" ? p.body : "",
              tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
            });
            executed++;
          }
          break;
        }
        case "plan.propose": {
          if (typeof p.text === "string" && p.text.trim()) {
            addNote({
              title: `📄 ${t("ai.proposal")} — ${new Date().toISOString().slice(0, 10)}`,
              body: p.text,
              tags: ["reja", "ai"],
            });
            executed++;
          }
          break;
        }
        case "summary.create": {
          if (typeof p.text === "string" && p.text.trim()) {
            setTextAnswer(p.text);
            addNote({
              title: `📊 ${t("ai.textAnswer")} — ${new Date().toISOString().slice(0, 10)}`,
              body: p.text,
              tags: ["hisobot", "ai"],
            });
            executed++;
          }
          break;
        }
      }
    }
    const rec = pushAIRecord(command || "(bridge)", proposal, "approved", executed);
    setPhase("done");
    import("sonner").then(({ toast }) =>
      toast(t("ai.approved"), {
        action: {
          label: t("common.undo"),
          onClick: () => {
            restore(snap);
            markAIRecordUndone(rec.id);
            toast(t("ai.undone"));
          },
        },
      })
    );
    setTimeout(() => {
      onClose();
      setPhase("input");
      setCommand("");
      setProposal(null);
      setTextAnswer(null);
    }, textAnswer ? 2200 : 800);
  };

  const reject = () => {
    if (proposal) pushAIRecord(command || "(bridge)", proposal, "rejected", 0);
    import("sonner").then(({ toast }) => toast(t("ai.rejected")));
    setPhase("input");
    setProposal(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: "60%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col rounded-t-3xl border bg-background"
      >
        {/* header */}
        <div className="relative overflow-hidden rounded-t-3xl border-b bg-card px-5 pb-4 pt-3">
          <div className="brand-grad-soft pointer-events-none absolute inset-0" />
          <div className="relative">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="flex items-center gap-2.5">
              <span className="brand-grad rounded-xl p-2 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <h2 className="text-[15px] font-bold">{t("ai.title")}</h2>
                <p className="text-[11px] text-muted-foreground">{t("ai.subtitle")}</p>
              </div>
              <button onClick={onClose} aria-label={t("common.close")} className="rounded-xl bg-muted p-2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* zanjir: model + BYOK + T0 */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <ChipMini
                active={!aiBlocked && (!inApk || byokActive)}
                icon={<Cloud className="h-3 w-3" />}
                label={inApk ? (byokActive ? `BYOK · ${settings.aiModel}` : "Cloud T4") : "Cloud T4"}
              />
              {byokActive && !inApk && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <ChipMini active icon={<KeyRound className="h-3 w-3" />} label="BYOK" />
                </>
              )}
              <span className="text-muted-foreground">→</span>
              <ChipMini active icon={<Cpu className="h-3 w-3" />} label="T0" />
              {aiBlocked && (
                <ChipMini active={false} icon={<ShieldCheck className="h-3 w-3" />} label={t("ai.killSwitch")} warn />
              )}
            </div>
          </div>
        </div>

        {/* body */}
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
          {phase === "input" && (
            <>
              {aiBlocked && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-rose-500" />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {limitReached ? t("ai.limitReached", { n: settings.aiDailyLimit }) : t("ai.killSwitchHint")}
                  </p>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-2xl border bg-card px-3.5 py-3">
                  <textarea
                    autoFocus
                    rows={2}
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        runAI();
                      }
                    }}
                    placeholder={t("ai.input")}
                    className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                <button
                  onClick={() => runAI()}
                  disabled={!command.trim()}
                  aria-label={t("ai.run")}
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-all active:scale-90",
                    command.trim() ? "brand-grad shadow-lg shadow-violet-500/25" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-1.5 mt-4 text-[11px] font-semibold text-muted-foreground">{t("ai.examples")}</p>
              <div className="flex flex-col gap-1.5">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setCommand(ex)}
                    className="rounded-2xl border bg-card px-3.5 py-2.5 text-left text-xs transition-colors hover:border-violet-500/40"
                  >
                    <span className="mr-1.5 text-violet-500">✦</span>
                    {ex}
                  </button>
                ))}
              </div>

              {/* Copy-Paste Bridge */}
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <button
                  onClick={() => {
                    setBridgeOpen(!bridgeOpen);
                    if (!bridgeOpen) buildBridgePrompt();
                  }}
                  className="flex w-full items-center gap-2 bg-muted/60 px-3.5 py-2.5 text-left"
                >
                  <ClipboardCopy className="h-4 w-4 text-teal-500" />
                  <span className="flex-1 text-xs font-bold">{t("ai.copyBridge")}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", bridgeOpen && "rotate-180")} />
                </button>
                {bridgeOpen && (
                  <div className="border-t p-3.5">
                    <p className="mb-2 text-[10px] leading-snug text-muted-foreground">{t("ai.copyBridgeHint")}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(bridgePrompt).then(
                          () => import("sonner").then(({ toast }) => toast(t("ai.copied"))),
                          () => {}
                        );
                      }}
                      className="mb-2 w-full rounded-xl bg-teal-500/10 py-2 text-xs font-bold text-teal-600 transition-transform active:scale-[0.98] dark:text-teal-300"
                    >
                      <ClipboardCopy className="mr-1.5 inline h-3.5 w-3.5" />
                      {t("ai.copyPrompt")}
                    </button>
                    <details className="mb-2 rounded-xl bg-muted/60 p-2.5">
                      <summary className="cursor-pointer text-[10px] font-semibold text-muted-foreground">
                        {t("ai.sanitized")}
                      </summary>
                      <pre className="thin-scroll mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap text-[9px] leading-relaxed text-muted-foreground">
                        {bridgePrompt}
                      </pre>
                    </details>
                    <textarea
                      rows={3}
                      value={pasteText}
                      onChange={(e) => {
                        setPasteText(e.target.value);
                        setPasteError(false);
                      }}
                      placeholder={t("ai.pasteArea")}
                      className="mb-2 w-full resize-none rounded-xl border bg-card px-3 py-2 font-mono text-[11px] outline-none"
                    />
                    {pasteError && <p className="mb-2 text-[10px] font-semibold text-rose-500">{t("ai.pasteBad")}</p>}
                    <button
                      onClick={runFromBridgePaste}
                      disabled={!pasteText.trim()}
                      className={cn(
                        "flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-transform active:scale-[0.98]",
                        pasteText.trim() ? "bg-teal-500 text-white" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" /> {t("ai.pasteValidate")}
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground/70">{t("ai.gwNote")}</p>
            </>
          )}

          {phase === "loading" && (
            <div className="py-6">
              <div className="mb-5 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                {t("ai.thinking")}
              </div>
              <div className="mx-auto flex max-w-[300px] flex-col gap-2">
                {STEPS.map((s, i) => (
                  <motion.div
                    key={s.key}
                    initial={false}
                    animate={{
                      opacity: i <= step ? 1 : 0.35,
                      scale: i === step ? 1.02 : 1,
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5",
                      i === step ? "border-violet-500/40 bg-violet-500/[0.07]" : "border-border bg-card"
                    )}
                  >
                    <s.icon className={cn("h-4 w-4", i <= step ? "text-violet-500" : "text-muted-foreground")} />
                    <span className="text-xs font-semibold">{t(`ai.step.${s.key}`)}</span>
                    {i < step && <Check className="ml-auto h-3.5 w-3.5 text-emerald-500" />}
                    {i === step && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-violet-500" />}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {(phase === "proposal" || phase === "done") && proposal && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {isFallback && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-2.5">
                  <Cpu className="h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-[10px] leading-snug text-muted-foreground">{t("ai.fallback")}</p>
                </div>
              )}

              <div className="mb-3 rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                    {t("ai.proposal")}
                  </p>
                  <ChipMini
                    active
                    icon={isFallback ? <Cpu className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                    label={`${proposal.model.provider} · ${proposal.model.class}`}
                  />
                </div>
                {proposal.summary && <p className="text-sm font-medium leading-snug">{proposal.summary}</p>}
                {textAnswer && (
                  <div className="mt-2 rounded-xl bg-card p-2.5 text-xs leading-relaxed">{textAnswer}</div>
                )}
              </div>

              {proposal.actions
                .filter((a) => a.action !== "summary.create" || !textAnswer)
                .map((a, i) => {
                  const lines = describeAction(a, lang);
                  const risk = riskLevelOf(a.action, proposal.actions.length);
                  return (
                    <div key={i} className="mb-2 rounded-2xl border bg-card p-3">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <code className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                          {a.action}
                        </code>
                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                          {t(`ai.riskBadge.${risk}`)}
                        </span>
                      </div>
                      {lines.map((l, j) => (
                        <p key={j} className={cn("text-sm leading-snug", j === 0 ? "font-semibold" : "text-xs text-muted-foreground")}>
                          {l}
                        </p>
                      ))}
                      {a.reason && <p className="mt-1.5 text-[10px] italic text-muted-foreground">↳ {a.reason}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${a.confidence * 100}%` }}
                            className={cn("h-full rounded-full", a.confidence >= 0.75 ? "bg-emerald-500" : a.confidence >= 0.5 ? "bg-amber-500" : "bg-rose-500")}
                          />
                        </div>
                        <span className="text-[9px] font-semibold text-muted-foreground">
                          {t("ai.confidence")} {(a.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* AI nima ko'rdi (PRD 5.5) */}
              <div className="mb-3 rounded-2xl bg-muted/50 p-3">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Eye className="h-3 w-3" /> {t("ai.dataUsed")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {proposal.data_used.map((d, i) => (
                    <span key={i} className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 font-mono text-[9px] text-teal-700 dark:text-teal-300">
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              {level === "dev" && (
                <details className="mb-3 rounded-2xl bg-muted/50 p-3">
                  <summary className="cursor-pointer text-[10px] font-semibold text-muted-foreground">{t("ai.jsonTab")}</summary>
                  <pre className="thin-scroll mt-2 max-h-40 overflow-auto text-[9px] leading-relaxed">
                    {JSON.stringify(proposal.actions, null, 2)}
                  </pre>
                </details>
              )}

              <p className="mb-3 text-[10px] leading-snug text-muted-foreground">{t("ai.approveHint")}</p>

              {phase === "proposal" && (
                <div className="flex gap-2">
                  <button
                    onClick={reject}
                    className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold text-muted-foreground transition-transform active:scale-[0.98]"
                  >
                    {t("common.reject")}
                  </button>
                  <button
                    onClick={execute}
                    className="brand-grad flex flex-[1.4] items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} /> {t("common.approve")}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ChipMini({ active, icon, label, warn }: { active: boolean; icon: React.ReactNode; label: string; warn?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
        active
          ? warn
            ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground/60"
      )}
    >
      {icon} {label}
    </span>
  );
}
