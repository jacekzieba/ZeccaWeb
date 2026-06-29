"use client";

import {
  ChartNoAxesCombined,
  Landmark,
  LaptopMinimal,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type PointerEvent,
} from "react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { Sparkline } from "@/components/charts/sparkline";
import { ValueVsDepositsChart } from "@/components/charts/value-vs-deposits-chart";
import { formatCurrency, formatPercent } from "@/lib/money";
import { landingCopy } from "./copy";
import { buildLandingDemoSnapshot } from "./landing-demo-data";
import { useCountUp } from "./use-count-up";

const PERIOD_LABELS = {
  "1Y": "1R",
  "2Y": "2L",
} as const;

type LandingCopyEditEvent = CustomEvent<{ id: string; html: string }>;

function useLandingCopyOverride(id: string, fallback: string) {
  const [html, setHtml] = useState(fallback);

  useEffect(() => {
    const editMode = new URLSearchParams(window.location.search).get("edit") === "1";
    if (!editMode) {
      setHtml(fallback);
      return;
    }

    const saved = window.localStorage.getItem(`zecca-landing-copy:${id}`);
    setHtml(saved ?? fallback);

    const onEdit = (event: Event) => {
      const detail = (event as LandingCopyEditEvent).detail;
      if (detail?.id === id) {
        setHtml(detail.html);
      }
    };
    window.addEventListener("zecca:landing-copy-edit", onEdit);
    return () => window.removeEventListener("zecca:landing-copy-edit", onEdit);
  }, [fallback, id]);

  return html;
}

function EditableHtml({
  as: Component,
  copyId,
  html,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as: ElementType;
  copyId: string;
  html: string;
}) {
  const renderedHtml = useLandingCopyOverride(copyId, html);
  return (
    <Component
      {...props}
      data-landing-edit-id={copyId}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

/** Apple's wordmark glyph — the App Store badges read as native, not generic. */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

function getThirtyDayChange(series: number[]) {
  if (series.length < 2 || series[0] === 0) return 0;
  return ((series.at(-1)! - series[0]) / series[0]) * 100;
}

/** Compact charts preserve each portfolio's demonstrated return but distribute
 * movement through the period, avoiding bookkeeping-style end-of-series jumps. */
function createPortfolioTrend(changePct: number, seed: number) {
  const points = 18;
  const amplitude = 0.7 + seed * 0.12;
  return Array.from({ length: points }, (_, index) => {
    const progress = index / (points - 1);
    const taper = Math.sin(Math.PI * progress);
    const base = 100 * (1 + (changePct / 100) * progress);
    return base + Math.sin((progress * 8 + seed) * Math.PI) * amplitude * taper;
  });
}

function TiltCard({
  className,
  children,
  label,
}: {
  className: string;
  children: React.ReactNode;
  label: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const animation = useRef<number | null>(null);

  const clearTilt = useCallback(() => {
    if (animation.current != null) cancelAnimationFrame(animation.current);
    frame.current?.style.setProperty("--tilt-x", "0deg");
    frame.current?.style.setProperty("--tilt-y", "0deg");
    frame.current?.style.setProperty("--lift", "0px");
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !window.matchMedia("(pointer: fine)").matches) return;
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    if (animation.current != null) cancelAnimationFrame(animation.current);
    animation.current = requestAnimationFrame(() => {
      const target = frame.current;
      if (!target) return;
      target.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
      target.style.setProperty("--tilt-y", `${(x * 6).toFixed(2)}deg`);
      target.style.setProperty("--lift", "-6px");
    });
  }, []);

  return (
    <div
      ref={frame}
      className={`product-card ${className}`}
      aria-label={label}
      onPointerMove={handlePointerMove}
      onPointerLeave={clearTilt}
    >
      {children}
    </div>
  );
}

export function LandingHero() {
  const [snapshot] = useState(buildLandingDemoSnapshot);
  const hero = landingCopy.hero;
  const totalReturn = snapshot.metrics.totalReturnPct;
  const portfolios = snapshot.portfolios.slice(0, 2);
  const portfolioPreviewTotal = portfolios.reduce((total, portfolio) => total + portfolio.value, 0);

  const animatedValue = useCountUp(snapshot.totalValue);
  const animatedReturn = useCountUp(totalReturn);

  const trustIcons = [ShieldCheck, LaptopMinimal, Landmark, ChartNoAxesCombined];

  return (
    <>
      <header className="hero landing-hero" id="top">
        <div className="wrap hero-layout">
          <section className="hero-copy">
            <EditableHtml as="span" copyId="hero.betaBanner" className="beta-banner" html={hero.betaBanner} />
            <EditableHtml as="div" copyId="hero.eyebrow" className="eyebrow" html={hero.eyebrow} />
            <EditableHtml as="h1" copyId="hero.title" html={hero.title} />
            <EditableHtml as="p" copyId="hero.lede" className="lede" html={hero.lede} />
            <ul className="hero-index" aria-label="Źródła danych i metody liczenia">
              {hero.sources.map((source, index) => (
                <EditableHtml as="li" copyId={`hero.sources.${index}`} html={source} key={source} />
              ))}
            </ul>
            <div className="hero-actions">
              <div className="store-badges">
                {hero.storeBadges.map((badge) => (
                  <a
                    key={badge.main}
                    className="store-badge"
                    href={hero.ctaPrimaryHref}
                    aria-label={`${badge.top} ${badge.main} — ${badge.soon}`}
                  >
                    <AppleGlyph />
                    <span className="sb-text">
                      <span className="sb-top">{badge.top}</span>
                      <span className="sb-main">{badge.main}</span>
                    </span>
                    <span className="store-soon">{badge.soon}</span>
                  </a>
                ))}
              </div>
              <a className="hero-beta-link" href={hero.ctaPrimaryHref}>
                {hero.ctaPrimary}
                <span aria-hidden="true">→</span>
              </a>
              <EditableHtml as="p" copyId="hero.note" className="hero-note" html={hero.note} />
            </div>
          </section>

          <section className="product-preview" aria-label="Interaktywny podgląd możliwości Zecca na danych demonstracyjnych">
            <TiltCard className="value-card" label="Wartość portfela i historia wartości">
              <div className="product-card-head">
                <div>
                  <EditableHtml as="p" copyId="preview.value.kicker" className="product-kicker" html="Wartość portfela" />
                  <p className="product-value">{formatCurrency(Math.round(animatedValue), "PLN")}</p>
                  <p className="product-change">
                    {animatedReturn >= 0 ? "+" : ""}{formatPercent(animatedReturn)} <span>od początku</span>
                  </p>
                </div>
                <span className="demo-status"><span /> Dane demonstracyjne</span>
              </div>
              <ValueVsDepositsChart
                value={snapshot.valuationSeries}
                deposits={snapshot.netInvestedSeries}
                currency="PLN"
                height={168}
                periodLabels={PERIOD_LABELS}
                animateOnView
              />
            </TiltCard>

            <TiltCard className="allocation-card" label="Alokacja aktywów">
              <EditableHtml as="p" copyId="preview.allocation.kicker" className="product-kicker" html="Alokacja" />
              <EditableHtml as="p" copyId="preview.allocation.heading" className="product-heading" html="Struktura aktywów" />
              <AllocationDonut slices={snapshot.allocation} />
            </TiltCard>

            <TiltCard className="portfolios-card" label="Portfele demonstracyjne">
              <EditableHtml as="p" copyId="preview.portfolios.kicker" className="product-kicker" html="Portfele" />
              <EditableHtml as="p" copyId="preview.portfolios.heading" className="product-heading" html="Podział na konta" />
              <div className="portfolio-preview-list">
                {portfolios.map((portfolio, index) => {
                  const change = getThirtyDayChange(portfolio.sparkline);
                  const trend = createPortfolioTrend(change, index + 1);
                  const colors = ["#234d38", "#9a7b3c", "#34699a"];
                  const color = colors[index] ?? "#234d38";
                  return (
                    <div className="portfolio-preview-row" key={portfolio.id}>
                      <div className="portfolio-name">
                        <span style={{ backgroundColor: color }} />
                        <div>
                          <strong>{portfolio.name}</strong>
                          <small>{formatCurrency(portfolio.value, "PLN")}</small>
                        </div>
                      </div>
                      <div className="portfolio-trend">
                        <Sparkline data={trend} color={color} width={68} height={24} strokeWidth={1.8} />
                        <b>{change >= 0 ? "+" : ""}{formatPercent(change)}</b>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="portfolio-preview-total">
                <span>Razem · {portfolios.length} konta</span>
                <b>{formatCurrency(portfolioPreviewTotal, "PLN")}</b>
              </div>
            </TiltCard>
          </section>
        </div>
      </header>

      <section className="trust-band" aria-label="Najważniejsze właściwości Zecca">
        <div className="wrap">
          <EditableHtml as="p" copyId="hero.proof" className="trust-proof" html={hero.proof} />
          <div className="trust-grid">
            {hero.trust.map((item, index) => {
              const Icon = trustIcons[index] ?? ShieldCheck;
              return (
                <div className="trust-item" key={item.title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
