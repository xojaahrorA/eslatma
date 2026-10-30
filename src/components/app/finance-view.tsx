"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip, deleteWithUndo } from "./kit";
import { dateKey, CATEGORY_ICON } from "@/lib/utils-app";
import { cn } from "@/lib/utils";
import type { FinanceCategory } from "@/lib/types";
import { motion } from "framer-motion";
import { Check, Lock, Pencil, Plus, Trash2, Wallet } from "lucide-react";

const CATS: FinanceCategory[] = ["food", "transport", "home", "health", "fun", "other"];
const CAT_STYLE: Record<string, string> = {
  food: "bg-orange-500",
  transport: "bg-sky-600",
  home: "bg-violet-500",
  health: "bg-emerald-500",
  fun: "bg-pink-500",
  other: "bg-zinc-400",
};

/** 25000 → "25 000" — kiritish paytida ham o'qishga qulay */
function groupDigits(s: string): string {
  const digits = s.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function FinanceView() {
  const { t } = useUlos();
  const expenses = useStore((s) => s.expenses);
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<FinanceCategory>("food");
  const [note, setNote] = useState("");

  // byudjet tahrirlash
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");

  const monthPrefix = dateKey(new Date()).slice(0, 7);
  const todayPrefix = dateKey(new Date());
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(monthPrefix)),
    [expenses, monthPrefix]
  );
  const spent = monthExpenses.reduce((a, e) => a + e.amount, 0);
  const todaySpent = monthExpenses
    .filter((e) => e.date === todayPrefix)
    .reduce((a, e) => a + e.amount, 0);
  const budget = settings.financeBudget || 0;
  const pct = budget > 0 ? spent / budget : 0;
  const over = budget > 0 && spent > budget;

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of monthExpenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return CATS.map((c) => ({ c, total: m.get(c) ?? 0 })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  const fmtMoney = (n: number) => groupDigits(String(Math.round(n)));

  const submit = () => {
    const n = Number(amount.replace(/\D/g, ""));
    if (!n || n <= 0) return;
    addExpense({ amount: n, category: cat, note: note.trim() || undefined });
    setAmount("");
    setNote("");
    import("sonner").then(({ toast }) => toast(t("fin.added")));
  };

  const openBudgetEdit = () => {
    setBudgetDraft(groupDigits(String(budget || "")));
    setEditingBudget(true);
  };

  const saveBudget = () => {
    const n = Number(budgetDraft.replace(/\D/g, ""));
    if (n >= 0) setSettings({ financeBudget: n });
    setEditingBudget(false);
    import("sonner").then(({ toast }) => toast(t("fin.budgetSaved")));
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* Maxfiylik — PRD 4.6 */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
        <Lock className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">{t("fin.secretBadge")}.</span>{" "}
          {t("ai.sanitized")}
        </p>
      </div>

      {/* Byudjet holati + tahrirlash joyi */}
      <SectionCard>
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("fin.spent")}</p>
            <p className={cn("text-2xl font-bold", over && "text-rose-500")}>
              {fmtMoney(spent)} <span className="text-xs font-medium text-muted-foreground">{t("fin.currency")}</span>
            </p>
            {todaySpent > 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("fin.today")}: <span className="font-semibold text-foreground">{fmtMoney(todaySpent)}</span>
              </p>
            )}
          </div>
          {!editingBudget ? (
            <button
              onClick={openBudgetEdit}
              className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <span>
                <span className="block text-[10px] leading-none text-muted-foreground">{t("fin.budget")}</span>
                <span className="mt-0.5 block text-sm font-semibold">
                  {budget > 0 ? fmtMoney(budget) : t("fin.budgetSet")}
                </span>
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-violet-500">{t("fin.budgetChange")}</span>
          )}
        </div>

        {/* Byudjet kiritish maydoni — "moliya kundaligini to'ldirish"ning birinchi joyi */}
        {editingBudget ? (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.05] p-3">
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {t("fin.budget")} ({t("fin.currency")})
            </label>
            <input
              autoFocus
              inputMode="numeric"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(groupDigits(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
              placeholder={t("fin.amountHint")}
              className="w-full rounded-xl bg-card px-3.5 py-2.5 text-base font-bold tabular-nums outline-none ring-1 ring-violet-500/30"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1_000_000, 2_000_000, 3_000_000, 5_000_000].map((v) => (
                <Chip
                  key={v}
                  onClick={() => setBudgetDraft(groupDigits(String(v)))}
                  className="cursor-pointer border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                >
                  {fmtMoney(v)}
                </Chip>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => setEditingBudget(false)}
                className="flex-1 rounded-xl bg-muted py-2.5 text-xs font-semibold"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={saveBudget}
                className="brand-grad flex flex-[1.5] items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> {t("fin.budgetSave")}
              </button>
            </div>
          </motion.div>
        ) : (
          budget > 0 && (
            <>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct * 100)}%` }}
                  transition={{ type: "spring", stiffness: 80 }}
                  className={cn("h-full rounded-full", over ? "bg-rose-500" : pct > 0.8 ? "bg-amber-500" : "bg-emerald-500")}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {over ? (
                  <span className="font-semibold text-rose-500">{t("fin.over")}</span>
                ) : (
                  <>
                    {t("fin.left")}: <span className="font-semibold text-foreground">{fmtMoney(budget - spent)}</span>
                  </>
                )}
              </p>
            </>
          )
        )}
      </SectionCard>

      {/* Tezkor qo'shish — "moliya kundaligini to'ldirish"ning ikkinchi joyi */}
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-bold">{t("fin.quickAdd")}</h3>
        </div>
        <div className="mb-1.5 flex gap-2">
          <label className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("fin.amount")} ({t("fin.currency")})
          </label>
          <label className="w-32 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("fin.note")}
          </label>
        </div>
        <div className="mb-2.5 flex gap-2">
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(groupDigits(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("fin.amountHint")}
            className="flex-1 rounded-2xl bg-muted px-4 py-3 text-base font-bold tabular-nums outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("fin.noteHint")}
            className="w-32 rounded-2xl bg-muted px-3 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-2xl border py-2 text-xs font-medium transition-all active:scale-95",
                cat === c
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <span className="mr-1">{CATEGORY_ICON[c]}</span>
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          className="brand-grad flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("common.add")}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/80">{t("fin.howTo")}</p>
      </SectionCard>

      {/* Kategoriyalar */}
      {byCat.length > 0 && (
        <SectionCard>
          <h3 className="mb-3 text-sm font-bold">{t("fin.byCategory")}</h3>
          <div className="flex flex-col gap-2.5">
            {byCat.map(({ c, total }) => (
              <div key={c} className="flex items-center gap-2.5">
                <span className="w-5 text-center text-sm">{CATEGORY_ICON[c]}</span>
                <div className="flex-1">
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="font-medium">{t(`cat.${c}`)}</span>
                    <span className="text-muted-foreground">{fmtMoney(total)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", CAT_STYLE[c])}
                      style={{ width: `${spent > 0 ? (total / spent) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* So'nggi yozuvlar */}
      <SectionCard>
        <h3 className="mb-3 text-sm font-bold">{t("fin.recent")}</h3>
        {expenses.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{t("fin.empty")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {expenses.slice(0, 12).map((e) => (
              <div key={e.id} className="group flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-sm">
                  {CATEGORY_ICON[e.category]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.note || t(`cat.${e.category}`)}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">−{fmtMoney(e.amount)}</span>
                <button
                  onClick={() => deleteWithUndo(() => deleteExpense(e.id), snapshot, restore, t, "undo.expenseDelete")}
                  aria-label={t("common.delete")}
                  className="rounded-lg p-1.5 text-muted-foreground/0 transition-colors hover:bg-rose-500/10 hover:text-rose-500 group-hover:text-muted-foreground/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
