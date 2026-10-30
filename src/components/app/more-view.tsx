"use client";

import { useUlos, SectionCard, Chip } from "./kit";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronRight,
  Fingerprint,
  NotebookPen,
  Settings2,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import type { ViewName } from "./kit";

export default function MoreView() {
  const { t, navigate, level } = useUlos();
  const aiRecords = useStore((s) => s.aiRecords);

  // «Oddiy» darajasida ilg‘or bo‘limlar (AI jurnali) yashiriladi — PRD 8
  const advanced = level !== "simple";

  const items: { view: ViewName; icon: React.ReactNode; title: string; sub: string; accent: string; badge?: string }[] = [
    {
      view: "analytics",
      icon: <BarChart3 className="h-5 w-5" />,
      title: t("more.analytics"),
      sub: t("more.analyticsSub"),
      accent: "bg-cyan-500/12 text-cyan-500",
    },
    {
      view: "notes",
      icon: <NotebookPen className="h-5 w-5" />,
      title: t("more.notes"),
      sub: t("more.notesSub"),
      accent: "bg-violet-500/12 text-violet-500",
    },
    {
      view: "focus",
      icon: <Timer className="h-5 w-5" />,
      title: t("more.focus"),
      sub: t("more.focusSub"),
      accent: "bg-teal-500/12 text-teal-500",
    },
    {
      view: "finance",
      icon: <Wallet className="h-5 w-5" />,
      title: t("more.finance"),
      sub: t("more.financeSub"),
      accent: "bg-amber-500/12 text-amber-500",
    },
    {
      view: "audit",
      icon: <Fingerprint className="h-5 w-5" />,
      title: t("more.audit"),
      sub: t("more.auditSub"),
      accent: "bg-rose-500/12 text-rose-500",
      badge: aiRecords.length > 0 ? String(aiRecords.length) : undefined,
    },
    {
      view: "settings",
      icon: <Settings2 className="h-5 w-5" />,
      title: t("more.settings"),
      sub: t("more.settingsSub"),
      accent: "bg-zinc-500/12 text-zinc-400",
    },
  ];

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
      {/* AI banner — «Oddiy» darajasida yashiriladi */}
      {advanced && (
        <button
          onClick={() => navigate("audit")}
          className="brand-grad relative overflow-hidden rounded-3xl p-4 text-left text-white transition-transform active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-white/15 p-2.5 backdrop-blur">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">{t("ai.title")}</p>
              <p className="text-[11px] text-white/80">{t("ai.subtitle")}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/80" />
          </div>
        </button>
      )}

      {items
        .filter((it) => advanced || it.view !== "audit")
        .map((it) => (
        <button key={it.view} onClick={() => navigate(it.view)}>
          <SectionCard className="flex items-center gap-3 py-3.5 transition-colors hover:bg-accent">
            <span className={cn("rounded-2xl p-2.5", it.accent)}>{it.icon}</span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold">{it.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{it.sub}</p>
            </div>
            {it.badge && (
              <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-500">{it.badge}</Chip>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </SectionCard>
        </button>
        ))}
    </div>
  );
}
