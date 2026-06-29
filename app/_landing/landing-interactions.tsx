"use client";

import { useEffect } from "react";

/**
 * Client-side behaviour for the landing page:
 *  - scroll-reveal for `.reveal` elements (IntersectionObserver)
 *  - feedback form → mailto handoff
 * The markup itself is injected as static HTML by the page (see content.ts),
 * so this component renders nothing and only wires up listeners after mount.
 */
export function LandingInteractions() {
  useEffect(() => {
    // Local copy-editing mode for reviewing landing text in place.
    // Open the page with `?edit=1`; edits are saved only in this browser.
    const editMode = new URLSearchParams(window.location.search).get("edit") === "1";
    let teardownTextEditor = () => {};
    if (editMode) {
      document.body.classList.add("landing-copy-editing");
      const root = document.querySelector<HTMLElement>(".zlanding");
      const selector = [
        ".zlanding h1",
        ".zlanding h2",
        ".zlanding h3",
        ".zlanding p",
        ".zlanding li",
        ".zlanding .beta-banner",
        ".zlanding .eyebrow",
        ".zlanding .sec-num",
        ".zlanding .kicker",
        ".zlanding .tag",
        ".zlanding .li",
        ".zlanding .product-kicker",
        ".zlanding .product-heading",
        ".zlanding .portfolio-name strong",
        ".zlanding .portfolio-preview-total span",
        ".zlanding .nav-links a",
        ".zlanding .store-badge span",
        ".zlanding .hero-beta-link",
      ].join(",");
      const dynamicTextSelector = [
        ".product-value",
        ".product-change",
        ".demo-status",
        ".portfolio-name small",
        ".portfolio-preview-total b",
        ".portfolio-trend b",
      ].join(",");
      const editableElements = root
        ? Array.from(root.querySelectorAll<HTMLElement>(selector))
            .filter((element) => !element.closest(".landing-edit-toolbar"))
            .filter((element) => !element.matches(dynamicTextSelector))
        : [];

      const saveHandlers: Array<[HTMLElement, EventListener]> = [];
      editableElements.forEach((element, index) => {
        const copyId = element.dataset.landingEditId ?? String(index);
        const key = `zecca-landing-copy:${copyId}`;
        const saved = window.localStorage.getItem(key);
        element.dataset.landingEditKey = key;
        element.dataset.landingEditId = copyId;
        element.dataset.landingInitialHtml = element.innerHTML;
        if (saved != null) {
          element.innerHTML = saved;
        }
        element.setAttribute("contenteditable", "true");
        element.setAttribute("spellcheck", "false");
        element.setAttribute("tabindex", "0");
        const persist = () => {
          window.localStorage.setItem(key, element.innerHTML);
        };
        const onClick = (event: Event) => {
          if (element instanceof HTMLAnchorElement) {
            event.preventDefault();
          }
        };
        element.addEventListener("input", persist);
        element.addEventListener("blur", persist);
        element.addEventListener("click", onClick);
        saveHandlers.push([element, persist], [element, onClick]);
      });

      const toolbar = document.createElement("div");
      toolbar.className = "landing-edit-toolbar";
      toolbar.innerHTML = `
        <strong>Tryb edycji tekstów</strong>
        <span>${editableElements.length} pól</span>
        <button type="button" data-action="reset">Reset</button>
      `;
      const onToolbarClick = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (target?.matches("button[data-action='reset']")) {
          editableElements.forEach((element) => {
            const key = element.dataset.landingEditKey;
            if (key) window.localStorage.removeItem(key);
            const html = element.dataset.landingInitialHtml ?? element.innerHTML;
            element.innerHTML = html;
            const copyId = element.dataset.landingEditId;
            if (copyId) {
              window.dispatchEvent(
                new CustomEvent("zecca:landing-copy-edit", {
                  detail: { id: copyId, html },
                }),
              );
            }
          });
        }
      };
      toolbar.addEventListener("click", onToolbarClick);
      (root ?? document.body).appendChild(toolbar);

      teardownTextEditor = () => {
        document.body.classList.remove("landing-copy-editing");
        saveHandlers.forEach(([element, handler]) => {
          element.removeEventListener("input", handler);
          element.removeEventListener("blur", handler);
          element.removeEventListener("click", handler);
        });
        editableElements.forEach((element) => {
          element.removeAttribute("contenteditable");
          element.removeAttribute("spellcheck");
          element.removeAttribute("tabindex");
          delete element.dataset.landingEditKey;
          delete element.dataset.landingInitialHtml;
        });
        toolbar.removeEventListener("click", onToolbarClick);
        toolbar.remove();
      };
    }

    // Beta waitlist → Airtable-backed API when explicitly enabled.
    const betaForm = document.getElementById("betaWaitlistForm") as HTMLFormElement | null;
    const betaStatus = document.getElementById("beta-waitlist-status");
    const betaEmail = document.getElementById("beta-email") as HTMLInputElement | null;
    const betaConsent = document.getElementById("beta-consent") as HTMLInputElement | null;
    const betaHoneypot = document.getElementById("beta-company") as HTMLInputElement | null;
    const betaButton = betaForm?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null;
    const setBetaStatus = (message: string, type: "idle" | "success" | "error" = "idle") => {
      if (!betaStatus) return;
      betaStatus.textContent = message;
      betaStatus.dataset.type = type;
    };
    const onBetaSubmit = async (event: Event) => {
      event.preventDefault();
      if (!betaForm || betaForm.dataset.enabled !== "true") {
        return;
      }

      const email = betaEmail?.value.trim() ?? "";
      const consent = Boolean(betaConsent?.checked);
      const company = betaHoneypot?.value.trim() ?? "";
      const labels = betaStatus?.dataset;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setBetaStatus(labels?.invalidEmail ?? "Podaj poprawny adres email.", "error");
        betaEmail?.focus();
        return;
      }
      if (!consent) {
        setBetaStatus(labels?.missingConsent ?? "Zaznacz zgodę.", "error");
        betaConsent?.focus();
        return;
      }

      betaButton?.setAttribute("disabled", "true");
      setBetaStatus("", "idle");
      try {
        const response = await fetch("/api/beta-waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            consent,
            company,
            source: "landing",
          }),
        });
        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? ((await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null)
          : null;
        if (!response.ok || payload?.ok !== true) {
          throw new Error(payload?.error ?? "waitlist_failed");
        }
        betaForm.reset();
        setBetaStatus(labels?.success ?? "Dzięki — zapisaliśmy email na liście beta.", "success");
        window.dispatchEvent(
          new CustomEvent("zecca:beta-waitlist-signup", {
            detail: { source: "landing" },
          }),
        );
      } catch {
        setBetaStatus(labels?.error ?? "Nie udało się zapisać. Spróbuj ponownie za chwilę.", "error");
      } finally {
        betaButton?.removeAttribute("disabled");
      }
    };
    betaForm?.addEventListener("submit", onBetaSubmit);

    // Feedback form → mailto
    const form = document.getElementById("fbForm") as HTMLFormElement | null;
    const ok = document.getElementById("fbOk");
    const onSubmit = (e: Event) => {
      e.preventDefault();
      const name = (document.getElementById("fb-name") as HTMLInputElement | null)?.value.trim() ?? "";
      const email = (document.getElementById("fb-email") as HTMLInputElement | null)?.value.trim() ?? "";
      const msg = (document.getElementById("fb-msg") as HTMLTextAreaElement | null)?.value.trim() ?? "";
      // Target address + subject come from copy.ts via data-* attributes on the form.
      const to = form?.dataset.email ?? "";
      const subject = form?.dataset.subject ?? "";
      const lines: string[] = [];
      if (name) lines.push("Imię: " + name);
      if (email) lines.push("Email: " + email);
      lines.push("");
      lines.push(msg);
      const href =
        "mailto:" +
        to +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(lines.join("\n"));
      ok?.classList.add("show");
      window.location.href = href;
      window.setTimeout(() => ok?.classList.remove("show"), 6000);
    };
    form?.addEventListener("submit", onSubmit);

    // Pointer tilt on feature cards — the same tactile lean as the hero cards,
    // applied to the statically-injected `.feat` grid. Fine pointers only.
    let teardownTilt = () => {};
    const finePointer =
      typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (finePointer && !reduceMotion) {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".zlanding .feat"));
      const frames = new WeakMap<HTMLElement, number>();
      const onTiltMove = (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement;
        const bounds = el.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        cancelAnimationFrame(frames.get(el) ?? 0);
        frames.set(
          el,
          requestAnimationFrame(() => {
            el.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
            el.style.setProperty("--tilt-y", `${(x * 5).toFixed(2)}deg`);
            el.style.setProperty("--lift", "-5px");
          }),
        );
      };
      const onTiltLeave = (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement;
        cancelAnimationFrame(frames.get(el) ?? 0);
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
        el.style.setProperty("--lift", "0px");
      };
      cards.forEach((card) => {
        card.addEventListener("pointermove", onTiltMove);
        card.addEventListener("pointerleave", onTiltLeave);
      });
      teardownTilt = () => {
        cards.forEach((card) => {
          card.removeEventListener("pointermove", onTiltMove);
          card.removeEventListener("pointerleave", onTiltLeave);
        });
      };
    }

    // Scroll reveal
    const els = Array.from(document.querySelectorAll<HTMLElement>(".zlanding .reveal"));
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io?.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
      );
      els.forEach((el) => io!.observe(el));
    }

    return () => {
      betaForm?.removeEventListener("submit", onBetaSubmit);
      form?.removeEventListener("submit", onSubmit);
      teardownTextEditor();
      teardownTilt();
      io?.disconnect();
    };
  }, []);

  return null;
}
