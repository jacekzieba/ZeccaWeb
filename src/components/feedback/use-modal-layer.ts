import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD = "input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/** Otwarte warstwy, od najniższej. Edytor instrumentu bywa otwarty nad
 * formularzem transakcji, a nad nim potwierdzenie — klawisze obsługuje tylko
 * najwyższa. */
const layers: object[] = [];

/**
 * Klawiatura i fokus warstwy modalnej: fokus wchodzi do środka (na `initialFocusRef`
 * albo pierwsze pole), Tab nie wychodzi poza panel, Escape zamyka, a po zamknięciu
 * fokus wraca tam, skąd okno otwarto.
 *
 * Nasłuch w fazie bąbelkowania: Escape, który obsłużyła już kontrolka w środku
 * (rozwinięta lista Select robi `preventDefault`), zamyka tylko ją, nie okno.
 */
export function useModalLayer(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const layer = {};
    layers.push(layer);
    const returnFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FIELD) ?? focusable()[0])?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (layers.at(-1) !== layer || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !panel?.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      layers.splice(layers.indexOf(layer), 1);
      returnFocus?.focus?.();
    };
  }, [open, panelRef, initialFocusRef]);
}
