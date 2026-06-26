"use client";

import {
  ChartNoAxesCombined,
  Landmark,
  LaptopMinimal,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { Sparkline } from "@/components/charts/sparkline";
import { ValueVsDepositsChart } from "@/components/charts/value-vs-deposits-chart";
import { formatCurrency, formatPercent } from "@/lib/money";
import { landingCopy } from "./copy";
import { buildLandingDemoSnapshot } from "./landing-demo-data";

const PERIOD_LABELS = {
  "1Y": "1R",
  "2Y": "2L",
} as const;

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
  const portfolios = snapshot.portfolios.slice(0, 3);

  const trustIcons = [ShieldCheck, LaptopMinimal, Landmark, ChartNoAxesCombined];

  return (
    <>
      <header className="hero landing-hero" id="top">
        <div className="wrap hero-layout">
          <section className="hero-copy">
            <span className="beta-banner" dangerouslySetInnerHTML={{ __html: hero.betaBanner }} />
            <div className="eyebrow">{hero.eyebrow}</div>
            <h1 dangerouslySetInnerHTML={{ __html: hero.title }} />
            <p className="lede" dangerouslySetInnerHTML={{ __html: hero.lede }} />
            <a className="btn btn-brand btn-lg hero-cta" href={hero.ctaPrimaryHref}>
              {hero.ctaPrimary}
            </a>
            <div className="waitlist" id="lista-beta">
              <label htmlFor="waitlist-email">{hero.waitlist.label}</label>
              <div className="waitlist-row">
                <input
                  id="waitlist-email"
                  type="email"
                  placeholder={hero.waitlist.placeholder}
                  disabled
                  aria-describedby="waitlist-note"
                />
                <button type="button" disabled>
                  {hero.waitlist.button}
                </button>
              </div>
              <p id="waitlist-note">{hero.waitlist.note}</p>
            </div>
          </section>

          <section className="product-preview" aria-label="Interaktywny podgląd możliwości Zecca na danych demonstracyjnych">
            <TiltCard className="value-card" label="Wartość portfela i historia wartości">
              <div className="product-card-head">
                <div>
                  <p className="product-kicker">Wartość portfela</p>
                  <p className="product-value">{formatCurrency(snapshot.totalValue, "PLN")}</p>
                  <p className="product-change">
                    {totalReturn >= 0 ? "+" : ""}{formatPercent(totalReturn)} <span>od początku</span>
                  </p>
                </div>
                <span className="demo-status"><span /> Dane demonstracyjne</span>
              </div>
              <ValueVsDepositsChart
                value={snapshot.valuationSeries}
                deposits={snapshot.netInvestedSeries}
                currency="PLN"
                height={194}
                periodLabels={PERIOD_LABELS}
              />
            </TiltCard>

            <TiltCard className="allocation-card" label="Alokacja aktywów">
              <p className="product-kicker">Alokacja</p>
              <p className="product-heading">Struktura aktywów</p>
              <AllocationDonut slices={snapshot.allocation} />
            </TiltCard>

            <TiltCard className="portfolios-card" label="Portfele demonstracyjne">
              <p className="product-kicker">Portfele</p>
              <p className="product-heading">Podział na konta</p>
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
            </TiltCard>
          </section>
        </div>
      </header>

      <section className="trust-band" aria-label="Najważniejsze właściwości Zecca">
        <div className="wrap trust-grid">
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
      </section>
    </>
  );
}
