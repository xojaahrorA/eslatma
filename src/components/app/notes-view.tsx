"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUlos, SectionCard, Chip, EmptyState, deleteWithUndo, TaskRow } from "./kit";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types";
import { motion } from "framer-motion";
import { Link2, NotebookPen, Pin, PinOff, Plus, Search, StickyNote } from "lucide-react";

/** [[havola]]larni ajratib chiqarish */
function parseWiki(body: string): { text: string; wiki?: string }[] {
  const parts: { text: string; wiki?: string }[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) });
    parts.push({ text: m[1], wiki: m[1] });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

export default function NotesView() {
  const { t } = useUlos();
  const notes = useStore((s) => s.notes);
  const tasks = useStore((s) => s.tasks);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const addNote = useStore((s) => s.addNote);
  const snapshot = useStore((s) => s.snapshot);
  const restore = useStore((s) => s.restore);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tags: "", pinned: false });

  const q = query.trim().toLowerCase();
  const filteredNotes = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            !q ||
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.tags.some((x) => x.toLowerCase().includes(q))
        )
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1)),
    [notes, q]
  );
  const matchedTasks = useMemo(
    () => (q ? tasks.filter((x) => x.title.toLowerCase().includes(q)).slice(0, 4) : []),
    [tasks, q]
  );

  const openCreate = (title = "") => {
    setForm({ title, body: "", tags: "", pinned: false });
    setCreating(true);
  };

  const submit = () => {
    const title = form.title.trim();
    if (!title && !form.body.trim()) return;
    addNote({
      title: title || "…",
      body: form.body,
      tags: form.tags.split(/[\s,]+/).filter(Boolean).map((x) => x.replace(/^#/, "")),
      pinned: form.pinned,
    });
    setCreating(false);
    import("sonner").then(({ toast }) => toast(t("notes.saved")));
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* qidiruv */}
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("notes.searchAll")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {/* vazifalar bo'ylab ham qidiruv natijalari */}
      {matchedTasks.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-[13px] font-bold text-muted-foreground">{t("nav.tasks")}</h3>
          <div className="flex flex-col gap-2">
            {matchedTasks.map((task) => (
              <TaskRow key={task.id} task={task} compact />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => openCreate()}
        className="brand-grad flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("notes.new")}
      </button>

      {filteredNotes.length === 0 && !q ? (
        <EmptyState icon={<StickyNote className="h-5 w-5" />} title={t("notes.empty")} />
      ) : filteredNotes.length === 0 ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title={t("notes.noResult")} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredNotes.map((n, i) => (
            <motion.button
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setEditing(n)}
              className={cn(
                "flex min-h-[120px] flex-col rounded-2xl border p-3 text-left transition-all active:scale-[0.98]",
                n.pinned ? "border-amber-500/30 bg-amber-500/[0.05]" : "bg-card"
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-1">
                <h3 className="line-clamp-2 text-[13px] font-bold leading-snug">{n.title}</h3>
                {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 rotate-45 text-amber-500" />}
              </div>
              <p className="line-clamp-3 flex-1 text-[11px] leading-snug text-muted-foreground">
                {n.body.slice(0, 120) || "…"}
              </p>
              {n.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {n.tags.slice(0, 2).map((tag) => (
                    <Chip key={tag} className="border-violet-500/25 bg-violet-500/10 px-1.5 text-violet-600 dark:text-violet-300">
                      #{tag}
                    </Chip>
                  ))}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* tahrirlash drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="mb-3 w-full bg-transparent text-lg font-bold outline-none"
              placeholder={t("notes.titleField")}
            />
            <textarea
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              rows={7}
              className="mb-3 w-full resize-none rounded-2xl bg-muted px-4 py-3 text-sm leading-relaxed outline-none"
              placeholder={t("notes.body") + " — [[havola]] ham ishlaydi"}
            />
            {/* havolalar render */}
            {parseWiki(editing.body).some((p) => p.wiki) && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-violet-500" />
                {parseWiki(editing.body)
                  .filter((p) => p.wiki)
                  .map((p, i) => {
                    const exists = notes.some((n) => n.title.toLowerCase() === p.wiki!.toLowerCase());
                    return (
                      <Chip
                        key={i}
                        onClick={() => {
                          if (exists) {
                            const target = notes.find((n) => n.title.toLowerCase() === p.wiki!.toLowerCase());
                            if (target) {
                              setEditing(null);
                              setEditing(target);
                              return;
                            }
                          }
                          const created = addNote({ title: p.wiki!, body: "" });
                          setEditing(null);
                          setEditing(created);
                        }}
                        className={cn(
                          "cursor-pointer px-2.5 py-1",
                          exists
                            ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                            : "border-dashed border-violet-400/50 text-violet-500/80"
                        )}
                      >
                        [[{p.wiki}]] {exists ? "" : "+"}
                      </Chip>
                    );
                  })}
              </div>
            )}
            <input
              value={editing.tags.join(" ")}
              onChange={(e) =>
                setEditing({ ...editing, tags: e.target.value.split(/[\s,]+/).filter(Boolean).map((x) => x.replace(/^#/, "")) })
              }
              placeholder={t("notes.tagsField")}
              className="mb-3 w-full rounded-2xl bg-muted px-4 py-2.5 text-sm outline-none"
            />
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setEditing({ ...editing, pinned: !editing.pinned })}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                  editing.pinned ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
                )}
              >
                {editing.pinned ? <Pin className="h-3.5 w-3.5 rotate-45" /> : <PinOff className="h-3.5 w-3.5" />}
                {t("notes.pinned")}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => {
                  deleteWithUndo(() => deleteNote(editing.id), snapshot, restore, t, "undo.noteDelete");
                  setEditing(null);
                }}
                className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-rose-500"
              >
                {t("common.delete")}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
                {t("common.close")}
              </button>
              <button
                onClick={() => {
                  updateNote(editing.id, {
                    title: editing.title,
                    body: editing.body,
                    tags: editing.tags,
                    pinned: editing.pinned,
                  });
                  setEditing(null);
                  import("sonner").then(({ toast }) => toast(t("notes.updated")));
                }}
                className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
              >
                {t("common.save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* yangi qayd drawer */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl border bg-popover p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("notes.titleField")}
              className="mb-3 w-full bg-transparent text-lg font-bold outline-none"
            />
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={6}
              placeholder={t("notes.body") + " — [[havola]] ham ishlaydi"}
              className="mb-3 w-full resize-none rounded-2xl bg-muted px-4 py-3 text-sm outline-none"
            />
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder={t("notes.tagsField")}
              className="mb-4 w-full rounded-2xl bg-muted px-4 py-2.5 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 rounded-2xl bg-muted py-3 text-sm font-semibold">
                {t("common.cancel")}
              </button>
              <button onClick={submit} className="brand-grad flex-1 rounded-2xl py-3 text-sm font-semibold text-white">
                {t("common.save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
