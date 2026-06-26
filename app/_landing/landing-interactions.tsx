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
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
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
      io?.disconnect();
    };
  }, []);

  return null;
}
