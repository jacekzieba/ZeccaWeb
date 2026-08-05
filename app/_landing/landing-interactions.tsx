"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

const DRAFT_COPY_PREFIX = "zecca-landing-copy:";
const PUBLISHED_COPY_PREFIX = "zecca-landing-published:";

function getStableCopyId(element: HTMLElement) {
  if (element.dataset.landingEditId) return element.dataset.landingEditId;

  // Copy saved by a numeric DOM position breaks as soon as a section is moved.
  // Hash the source element instead, so old positional edits cannot land in an
  // unrelated card and new edits stay associated with their original text.
  const source = [
    element.closest("section, header, footer")?.id ?? "landing",
    element.tagName,
    element.className,
    element.textContent?.trim() ?? "",
  ].join("|");
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return `auto-${(hash >>> 0).toString(36)}`;
}

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
    // Open the page with `?edit=1`; drafts and published changes stay in this browser.
    const editMode = new URLSearchParams(window.location.search).get("edit") === "1";
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
      ".zlanding .faq [data-landing-edit-id]",
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

    editableElements.forEach((element) => {
      const published = window.localStorage.getItem(`${PUBLISHED_COPY_PREFIX}${getStableCopyId(element)}`);
      if (published != null) element.innerHTML = published;
    });

    let teardownTextEditor = () => {};
    if (editMode) {
      document.body.classList.add("landing-copy-editing");

      const saveHandlers: Array<[HTMLElement, EventListener]> = [];
      editableElements.forEach((element) => {
        const copyId = getStableCopyId(element);
        const key = `${DRAFT_COPY_PREFIX}${copyId}`;
        const publishedKey = `${PUBLISHED_COPY_PREFIX}${copyId}`;
        const saved = window.localStorage.getItem(key);
        element.dataset.landingEditKey = key;
        element.dataset.landingPublishedKey = publishedKey;
        element.dataset.landingEditId = copyId;
        element.dataset.landingInitialHtml = element.innerHTML;
        if (saved != null) {
          element.innerHTML = saved;
        }
        const syncEmptyState = () => {
          element.classList.toggle("landing-copy-empty", !element.textContent?.trim());
        };
        syncEmptyState();
        element.setAttribute("contenteditable", "true");
        element.setAttribute("spellcheck", "false");
        element.setAttribute("tabindex", "0");
        const persist = () => {
          window.localStorage.setItem(key, element.innerHTML);
          syncEmptyState();
        };
        const onClick = (event: Event) => {
          if (element instanceof HTMLAnchorElement) {
            event.preventDefault();
          }
          if (element.closest("summary")) {
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
        <button type="button" data-action="publish">Opublikuj</button>
        <button type="button" data-action="reset">Reset</button>
      `;
      const onToolbarClick = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (target?.matches("button[data-action='publish']")) {
          editableElements.forEach((element) => {
            const key = element.dataset.landingPublishedKey;
            if (key) window.localStorage.setItem(key, element.innerHTML);
          });
          const publishedUrl = new URL(window.location.href);
          publishedUrl.searchParams.delete("edit");
          window.location.assign(publishedUrl);
        }
        if (target?.matches("button[data-action='reset']")) {
          editableElements.forEach((element) => {
            const key = element.dataset.landingEditKey;
            if (key) window.localStorage.removeItem(key);
            const publishedKey = element.dataset.landingPublishedKey;
            const html = (publishedKey ? window.localStorage.getItem(publishedKey) : null)
              ?? element.dataset.landingInitialHtml
              ?? element.innerHTML;
            element.innerHTML = html;
            element.classList.remove("landing-copy-empty");
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
          element.classList.remove("landing-copy-empty");
          delete element.dataset.landingEditKey;
          delete element.dataset.landingPublishedKey;
          delete element.dataset.landingInitialHtml;
        });
        toolbar.removeEventListener("click", onToolbarClick);
        toolbar.remove();
      };
    }

    // Mobile navigation (hamburger). The nav links become a dropdown panel
    // below the bar; the burger toggles it and manages aria-expanded so it
    // stays accessible on touch/narrow viewports.
    const navBurger = document.getElementById("navBurger");
    const navPanel = document.getElementById("navLinks");
    const navEl = navBurger?.closest("nav") ?? null;
    const isMenuOpen = () => navBurger?.getAttribute("aria-expanded") === "true";
    const setMenu = (open: boolean) => {
      navPanel?.classList.toggle("is-open", open);
      navBurger?.setAttribute("aria-expanded", open ? "true" : "false");
      navBurger?.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
    };
    const onBurgerClick = (event: Event) => {
      event.stopPropagation();
      setMenu(!isMenuOpen());
    };
    const onPanelClick = (event: Event) => {
      if ((event.target as HTMLElement).closest("a")) setMenu(false);
    };
    const onMenuDocClick = (event: Event) => {
      if (isMenuOpen() && !navEl?.contains(event.target as Node)) setMenu(false);
    };
    const onMenuKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMenuOpen()) {
        setMenu(false);
        navBurger?.focus();
      }
    };
    const onMenuResize = () => {
      if (window.innerWidth > 980) setMenu(false);
    };
    navBurger?.addEventListener("click", onBurgerClick);
    navPanel?.addEventListener("click", onPanelClick);
    document.addEventListener("click", onMenuDocClick);
    document.addEventListener("keydown", onMenuKeydown);
    window.addEventListener("resize", onMenuResize);

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
        setBetaStatus(labels?.invalidEmail ?? "Podaj poprawny adres e-mail.", "error");
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
        setBetaStatus(labels?.success ?? "Dziękujemy! Wyślemy Ci niedługo informacje o dostępie do aplikacji.", "success");
        track("Beta Waitlist Signup", { source: "landing" });
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
      if (email) lines.push("E-mail: " + email);
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

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const landingAnchors = root
      ? Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))
      : [];
    const onAnchorClick = (event: Event) => {
      if (
        event.defaultPrevented ||
        (event instanceof MouseEvent && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))
      ) return;
      const anchor = event.currentTarget as HTMLAnchorElement;
      const hash = anchor.getAttribute("href");
      const target = hash && hash !== "#" ? document.querySelector<HTMLElement>(hash) : null;
      if (!target) return;

      event.preventDefault();
      window.history.pushState(null, "", hash);
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    };
    landingAnchors.forEach((anchor) => anchor.addEventListener("click", onAnchorClick));

    const platformTabHandlers: Array<[HTMLElement, string, EventListener]> = [];
    document.querySelectorAll<HTMLElement>("[data-platform-gallery]").forEach((gallery) => {
      const tabs = Array.from(gallery.querySelectorAll<HTMLButtonElement>("[data-platform-target]"));
      const panels = Array.from(gallery.querySelectorAll<HTMLElement>("[data-platform-panel]"));
      const stories = Array.from(gallery.querySelectorAll<HTMLElement>("[data-platform-copy]"));
      const activateShot = (button: HTMLButtonElement) => {
        const panel = button.closest<HTMLElement>("[data-platform-panel]");
        const image = panel?.querySelector<HTMLImageElement>("[data-platform-shot]");
        if (!panel || !image) return;

        panel.querySelectorAll<HTMLButtonElement>("[data-platform-shot-target]").forEach((shotButton) => {
          shotButton.setAttribute("aria-pressed", shotButton === button ? "true" : "false");
        });
        image.src = button.dataset.src ?? image.src;
        image.alt = button.dataset.alt ?? image.alt;
        image.width = Number(button.dataset.width) || image.width;
        image.height = Number(button.dataset.height) || image.height;
        image.classList.remove("is-changing");
        window.requestAnimationFrame(() => image.classList.add("is-changing"));
      };
      const activate = (target: string, focus = false) => {
        const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.dataset.platformTarget === target));
        gallery.querySelector<HTMLElement>(".platform-tabs")?.style.setProperty("--platform-index", String(activeIndex));
        tabs.forEach((tab) => {
          const active = tab.dataset.platformTarget === target;
          tab.setAttribute("aria-selected", active ? "true" : "false");
          tab.tabIndex = active ? 0 : -1;
          if (active && focus) tab.focus();
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.platformPanel !== target;
        });
        stories.forEach((story) => {
          story.hidden = story.dataset.platformCopy !== target;
        });
      };

      gallery.querySelectorAll<HTMLButtonElement>("[data-platform-shot-target]").forEach((button) => {
        const onClick = () => activateShot(button);
        button.addEventListener("click", onClick);
        platformTabHandlers.push([button, "click", onClick]);
      });

      tabs.forEach((tab, index) => {
        const onClick = () => activate(tab.dataset.platformTarget ?? "");
        const onKeydown = (event: Event) => {
          const keyboardEvent = event as KeyboardEvent;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(keyboardEvent.key)) return;
          keyboardEvent.preventDefault();
          let nextIndex = index;
          if (keyboardEvent.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
          if (keyboardEvent.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
          if (keyboardEvent.key === "Home") nextIndex = 0;
          if (keyboardEvent.key === "End") nextIndex = tabs.length - 1;
          activate(tabs[nextIndex]?.dataset.platformTarget ?? "", true);
        };
        tab.addEventListener("click", onClick);
        tab.addEventListener("keydown", onKeydown);
        platformTabHandlers.push([tab, "click", onClick], [tab, "keydown", onKeydown]);
      });

      let touchStartX = 0;
      let touchStartY = 0;
      const onTouchStart = (event: Event) => {
        if (event.target instanceof Element && event.target.closest("[data-platform-shot-target]")) return;
        const touch = (event as TouchEvent).changedTouches[0];
        touchStartX = touch?.clientX ?? 0;
        touchStartY = touch?.clientY ?? 0;
      };
      const onTouchEnd = (event: Event) => {
        if (event.target instanceof Element && event.target.closest("[data-platform-shot-target]")) return;
        const touch = (event as TouchEvent).changedTouches[0];
        if (!touch) return;
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        const currentIndex = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
        const nextIndex = Math.min(tabs.length - 1, Math.max(0, currentIndex + (deltaX < 0 ? 1 : -1)));
        if (nextIndex !== currentIndex) activate(tabs[nextIndex]?.dataset.platformTarget ?? "");
      };
      gallery.addEventListener("touchstart", onTouchStart, { passive: true });
      gallery.addEventListener("touchend", onTouchEnd, { passive: true });
      platformTabHandlers.push([gallery, "touchstart", onTouchStart], [gallery, "touchend", onTouchEnd]);
    });

    const navProgress = document.querySelector<HTMLElement>(".zlanding .nav-progress");
    const navLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".zlanding .nav-links a.lnk[href^='#']"),
    );
    const navSections = navLinks
      .map((link) => {
        const href = link.getAttribute("href") ?? "";
        return { link, section: href ? document.querySelector<HTMLElement>(href) : null };
      })
      .filter((entry): entry is { link: HTMLAnchorElement; section: HTMLElement } => Boolean(entry.section));
    let navFrame = 0;
    const updateNav = () => {
      navFrame = 0;
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      navProgress?.style.setProperty("--scroll-progress", String(Math.min(1, window.scrollY / scrollRange)));
      const navOffset = 120;
      let active: HTMLAnchorElement | null = null;
      let activeTop = Number.NEGATIVE_INFINITY;
      navSections.forEach((entry) => {
        const sectionTop = entry.section.getBoundingClientRect().top + window.scrollY;
        if (sectionTop <= window.scrollY + navOffset && sectionTop > activeTop) {
          active = entry.link;
          activeTop = sectionTop;
        }
      });
      navSections.forEach((entry) => {
        const isActive = entry.link === active;
        entry.link.classList.toggle("is-active", isActive);
        if (isActive) entry.link.setAttribute("aria-current", "location");
        else entry.link.removeAttribute("aria-current");
      });
    };
    const onScroll = () => {
      if (!navFrame) navFrame = requestAnimationFrame(updateNav);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    updateNav();
    navFrame = requestAnimationFrame(updateNav);
    window.addEventListener("hashchange", onScroll);

    // Pointer tilt on feature cards — the same tactile lean as the hero cards,
    // applied to the statically-injected `.feat` grid. Fine pointers only.
    let teardownTilt = () => {};
    const finePointer =
      typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    if (finePointer && !reduceMotion) {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(".zlanding .feat, .zlanding .product-card"),
      );
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

    // Scroll reveal. Klase js-reveal dodajemy DOPIERO TERAZ — dzieki temu, jesli
    // cokolwiek wyzej rzuci wyjatkiem albo skrypt sie nie wykona, tresc pozostaje
    // widoczna zamiast zniknac. Animacja jest wzbogaceniem, nie warunkiem.
    root?.classList.add("js-reveal");
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
      navBurger?.removeEventListener("click", onBurgerClick);
      navPanel?.removeEventListener("click", onPanelClick);
      document.removeEventListener("click", onMenuDocClick);
      document.removeEventListener("keydown", onMenuKeydown);
      window.removeEventListener("resize", onMenuResize);
      betaForm?.removeEventListener("submit", onBetaSubmit);
      form?.removeEventListener("submit", onSubmit);
      landingAnchors.forEach((anchor) => anchor.removeEventListener("click", onAnchorClick));
      platformTabHandlers.forEach(([element, eventName, handler]) => {
        element.removeEventListener(eventName, handler);
      });
      teardownTextEditor();
      teardownTilt();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", onScroll);
      cancelAnimationFrame(navFrame);
      io?.disconnect();
    };
  }, []);

  return null;
}
