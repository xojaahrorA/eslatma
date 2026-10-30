"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip, EmptyState } from "./kit";
import { chainHash, fmtTime } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  ChevronDown,
  Eye,
  Fingerprint,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ban,
  Undo2,
} from "lucide-react";

export default function AuditView() {
  const { t, lang, level } = useUlos();
  const aiRecords = useStore((s) => s.aiRecords);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chainState, setChainState] = useState<"idle" | "ok" | "broken">("idle");

  /** Zanjir salomatligini tekshirish — append-only jurnal (PRD 7.3) */
  const verifyChain = () => {
    const ordered = [...aiRecords].reverse(); // eng eskisi birinchi
    let prev = "genesis";
    for (const rec of ordered) {
      const expected = chainHash(rec.prevHash, JSON.stringify({ command: rec.command, proposal: rec.proposal, decision: rec.decision, executedCount: rec.executedCount }));
      if (rec.prevHash !== prev || rec.hash !== expected) {
        setChainState("broken");
        return;
      }
      prev = rec.hash;
    }
    setChainState("ok");
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      <SectionCard className="border-violet-500/20">
        <div className="flex items-start gap-3">
          <span className="brand-grad-soft rounded-2xl p-2.5 text-violet-500">
            <Fingerprint className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-base font-bold">{t("audit.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("audit.subtitle")}</p>
          </div>
        </div>
        {aiRecords.length > 0 && (
          <button
            onClick={verifyChain}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold transition-transform active:scale-[0.98]",
              chainState === "ok"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : chainState === "broken"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {chainState === "ok" ? <ShieldCheck className="h-4 w-4" /> : chainState === "broken" ? <ShieldAlert className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {chainState === "ok"
              ? t("audit.chainOk")
              : chainState === "broken"
                ? t("audit.chainBroken")
                : t("audit.checkChain")}
          </button>
        )}
      </SectionCard>

      {aiRecords.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title={t("audit.empty")}
          hint={t("ai.gwNote")}
        />
      ) : (
        aiRecords.map((rec, idx) => {
          const isOpen = expanded === rec.id;
          const risk = rec.proposal.actions.some((a) => a.action.includes("delete")) ? "R5" : "R2";
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
            >
              <SectionCard className={cn("transition-shadow", isOpen && "ring-1 ring-violet-500/30")}>
                <button className="flex w-full items-start gap-3 text-left" onClick={() => setExpanded(isOpen ? null : rec.id)}>
                  <span
                    className={cn(
                      "mt-0.5 rounded-xl p-2",
                      rec.decision === "approved"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : rec.decision === "rejected"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {rec.decision === "approved" ? <BadgeCheck className="h-4 w-4" /> : rec.decision === "rejected" ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {t("audit.record", { n: aiRecords.length - idx })}
                      </span>
                      <Chip
                        className={cn(
                          rec.decision === "approved"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : rec.decision === "rejected"
                              ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {t(`audit.decision.${rec.decision}`)}
                      </Chip>
                      {rec.decision !== "rejected" && (
                        <Chip className="border-zinc-500/25 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300">{risk}</Chip>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium">«{rec.command}»</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {fmtTime(rec.ts, lang)} · {rec.proposal.model.provider} ·{" "}
                      {rec.decision !== "rejected" && t("audit.executed", { n: rec.executedCount })}
                    </p>
                  </div>
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {/* amallar */}
                      {rec.proposal.actions.map((a, i) => (
                        <div key={i} className="rounded-2xl bg-muted/60 p-2.5">
                          <div className="mb-1 flex items-center gap-1.5">
                            <code className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                              {a.action}
                            </code>
                            <span className="text-[10px] text-muted-foreground">×{a.confidence.toFixed(2)}</span>
                          </div>
                          {typeof a.params.text === "string" && (
                            <p className="text-xs leading-snug text-muted-foreground">{a.params.text.slice(0, 200)}</p>
                          )}
                          {typeof a.params.title === "string" && (
                            <p className="text-xs font-medium">{a.params.title}</p>
                          )}
                          {a.reason && <p className="mt-1 text-[10px] italic text-muted-foreground">↳ {a.reason}</p>}
                        </div>
                      ))}

                      {/* AI nima ko'rdi (PRD 5.5: "AI nimani ko'rdi?" tugmasi) */}
                      <div>
                        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                          <Eye className="h-3 w-3" /> {t("audit.dataUsed")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rec.proposal.data_used.map((d, i) => (
                            <Chip key={i} className="border-teal-500/25 bg-teal-500/10 font-mono text-teal-700 dark:text-teal-300">
                              {d}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      {/* xesh zanjiri ko'rinishi */}
                      <div className="rounded-2xl bg-muted/60 p-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                        <p className="truncate">← {rec.prevHash}</p>
                        <p className="truncate font-semibold text-violet-500">{rec.hash} ●</p>
                      </div>

                      {/* dasturchi darajasi: to'liq JSON */}
                      {level === "dev" && (
                        <details className="rounded-2xl bg-muted/60 p-2.5">
                          <summary className="cursor-pointer text-[10px] font-semibold text-muted-foreground">
                            {t("ai.jsonTab")}
                          </summary>
                          <pre className="thin-scroll mt-2 max-h-44 overflow-auto text-[10px] leading-relaxed">
                            {JSON.stringify(rec.proposal, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </motion.div>
                )}
              </SectionCard>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
