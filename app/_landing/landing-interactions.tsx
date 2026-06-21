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
      form?.removeEventListener("submit", onSubmit);
      io?.disconnect();
    };
  }, []);

  return null;
}
