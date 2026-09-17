"use client";

import { token } from "@/design/tokens";
import { v2Mix } from "@/lib/v2-design";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Styled replacement for a native <select>. The native element's open popup
 * can't be recolored with CSS at all — its highlighted/hovered row is drawn
 * by the OS using the system accent color, which shows up as an
 * out-of-palette magenta whenever a viewer's OS accent isn't the app's
 * amber. This renders the whole list ourselves instead.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  disabled,
  // Not enforced natively — a custom listbox has no HTML5 validity API —
  // but surfaced as aria-required, and read off props by the surrounding
  // <Field> to decide whether to render an "opcjonalnie" label.
  required,
  // For the standalone filter selects that had no wrapping <label> and
  // relied on the native element's own aria-label — a <Field>-wrapped
  // Select gets its name from that label instead and can leave this unset.
  ariaLabel,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openAt(index: number) {
    setHighlighted(index);
    setOpen(true);
  }

  function highlightedOnOpen() {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  }

  function commit(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAt(highlightedOnOpen());
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) => Math.min(options.length - 1, h + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(highlighted);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(highlightedOnOpen()))}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        style={{
          width: "100%",
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? ""}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 200,
            margin: 0,
            padding: 4,
            listStyle: "none",
            borderRadius: "var(--r-lg)",
            border: `0.5px solid ${token("line")}`,
            background: token("surface"),
            boxShadow: `0 8px 24px ${v2Mix(token("ink"), 0.18)}`,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {options.map((opt, index) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlighted(index)}
              // mousedown (not click): selecting an option removes this
              // popup from the DOM. If that happens between a real click's
              // mousedown and mouseup, the browser can hand the pending
              // click to whatever now sits at those coordinates — which is
              // the trigger button, re-opening what we just closed.
              // preventDefault suppresses that follow-up click entirely, the
              // standard fix every custom-dropdown implementation uses.
              onMouseDown={(event) => {
                event.preventDefault();
                commit(index);
              }}
              style={{
                padding: "7px 10px",
                borderRadius: "var(--r-md)",
                fontSize: 13,
                cursor: opt.disabled ? "default" : "pointer",
                color: opt.disabled ? token("inkFaint") : token("ink"),
                background: index === highlighted ? v2Mix(token("accent"), 0.16) : "transparent",
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
