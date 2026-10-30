"use client";

/**
 * ─── PinField — chiroyli nuqtali PIN kiritish maydoni ────────────────────────
 * Haqiqiy input yashirin (faqat klaviatura uchun), o'rniga gradient nuqtalar
 * ko'rinadi. 4–8 raqam; faol nuqta yorug'lik bilan "nafas oladi".
 */

import { useRef, useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PinField({
  value,
  onChange,
  onSubmit,
  shake = false,
  autoFocus = true,
  ariaLabel = "PIN",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  shake?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const slots = Math.max(4, value.length);

  const push = (d: string) => {
    if (value.length >= 8) return;
    onChange((value + d).slice(0, 8));
  };

  return (
    <div className={cn("relative w-full", shake && "animate-[lockshake_0.4s_ease-in-out]")}>
      {/* Ko'rinadigan nuqtalar */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        aria-label={ariaLabel}
        className="group flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border border-border/60 bg-muted/40 px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
      >
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < value.length;
          const active = i === value.length && focused;
          return (
            <span
              key={i}
              className={cn(
                "relative h-3.5 w-3.5 rounded-full border-2 transition-all duration-200",
                filled
                  ? "border-transparent bg-gradient-to-br from-violet-500 to-fuchsia-500 scale-110 shadow-[0_0_10px_-1px] shadow-fuchsia-500/60"
                  : "border-muted-foreground/40 bg-transparent",
                active && "border-violet-500/70 bg-violet-500/20 animate-pulse"
              )}
            />
          );
        })}
        {/* O'chirish tugmasi — nuqtalar ustida o'ngda (input'dan yuqorida) */}
        {value.length > 0 && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="delete"
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.slice(0, -1));
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 z-20 -translate-y-1/2 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Delete className="h-4 w-4" />
          </span>
        )}
      </button>

      {/* Yashirin haqiqiy input — raqamli klaviatura ochiladi */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        aria-label={ariaLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
        onKeyDown={(e) => e.key === "Enter" && onSubmit && onSubmit()}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
