import { token } from "@/design/tokens";
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";
import { formatCurrency, formatPercent } from "@/lib/money";
import { AnimatedCurrencyMetric, AnimatedPercentMetric } from "./animated-metric";
import { landingCopy } from "./copy";
import { buildLandingDemoSnapshot } from "./landing-demo-data";
import { StaticValueChart } from "./static-value-chart";
const ALLOCATION_COLORS = [token("assetEquity"), token("assetCrypto"), token("assetCash"), token("assetBonds")];
const PORTFOLIO_COLORS = ["#234d38", "#9a7b3c", token("assetEquity")];

type EditableHtmlProps = HTMLAttributes<HTMLElement> & {
  as: ElementType;
  copyId: string;
  html: string;
};

function EditableHtml({ as: Component, copyId, html, ...props }: EditableHtmlProps) {
  return (
    <Component
      {...props}
      data-landing-edit-id={copyId}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

function TrustIcon({ index }: { index: number }) {
  const paths = [
    <path key="shield" d="M12 3l7 3.5v5.2c0 4.4-2.8 7.3-7 8.8-4.2-1.5-7-4.4-7-8.8V6.5L12 3zM9 12l2 2 4-4" />,
    <path key="laptop" d="M4 5.5h16v10H4zM2.5 18.5h19M9 18.5l.8-3h4.4l.8 3" />,
    <path key="landmark" d="M4 10h16M6 10v7M10 10v7M14 10v7M18 10v7M4 19h16M12 4l8 4H4z" />,
    <path key="chart" d="M4 18h16M6 15l4-4 3 3 5-7M18 7h-4M18 7v4" />,
  ];

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[index] ?? paths[0]}
    </svg>
  );
}

function getThirtyDayChange(series: number[]) {
  if (series.length < 2 || series[0] === 0) return 0;
  return ((series.at(-1)! - series[0]) / series[0]) * 100;
}

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

function makePolyline(values: number[], width: number, height: number, pad = 2) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = pad + (height - pad * 2) - ((value - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function StaticAllocationDonut({ slices }: { slices: Array<{ label: string; percent: number }> }) {
  const size = 168;
  const center = size / 2;
  const thickness = 24;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + slice.percent, 0) || 100;
  let offset = 0;

  return (
    <div data-testid="allocation-donut" className="static-allocation">
      <div className="static-allocation-plot">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Alokacja aktywów">
          {slices.map((slice, index) => {
            const dash = (slice.percent / total) * circumference - 3;
            const gap = circumference - dash;
            const rotation = (offset / total) * 360 - 90;
            offset += slice.percent;
            return (
              <circle
                key={slice.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, dash)} ${gap}`}
                strokeLinecap="butt"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: `${center}px ${center}px`,
                  animationDelay: `${180 + index * 90}ms`,
                  "--donut-length": circumference,
                } as CSSProperties}
              />
            );
          })}
          <text x={center} y={center - 6} textAnchor="middle" className="donut-label">ALOKACJA</text>
          <text x={center} y={center + 12} textAnchor="middle" className="donut-count">{slices.length}</text>
          <text x={center} y={center + 26} textAnchor="middle" className="donut-caption">klas</text>
        </svg>
      </div>
      <div className="static-allocation-legend">
        {slices.map((slice, index) => (
          <div key={slice.label} data-testid="allocation-donut-legend">
            <i style={{ background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }} />
            <span>{slice.label}</span>
            <b>{slice.percent.toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function SparklineSvg({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  return (
    <svg width="68" height="24" viewBox="0 0 68 24" aria-hidden="true">
      <polyline
        points={makePolyline(data, 68, 24, 3)}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProductCard({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={`product-card ${className}`} aria-label={label}>
      {children}
    </div>
  );
}

export function LandingHero() {
  const snapshot = buildLandingDemoSnapshot();
  const hero = landingCopy.hero;
  const totalReturn = snapshot.metrics.totalReturnPct;
  const portfolios = snapshot.portfolios.slice(0, 2);
  const portfolioPreviewTotal = portfolios.reduce((total, portfolio) => total + portfolio.value, 0);

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
              {hero.sources.map((source) => (
                <EditableHtml
                  as="li"
                  copyId={`hero.sources.${source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  html={source}
                  key={source}
                />
              ))}
            </ul>
            <div className="hero-actions">
              <div className="store-badges">
                {hero.storeBadges.map((badge) => (
                  <span key={badge.main} className="store-badge is-unavailable" aria-disabled="true">
                    <AppleGlyph />
                    <span className="sb-text">
                      <span className="sb-top">{badge.top}</span>
                      <span className="sb-main">{badge.main}</span>
                    </span>
                    <span className="store-soon">{badge.soon}</span>
                  </span>
                ))}
              </div>
              <div className="hero-entry-links">
                <a className="btn btn-brand" href={hero.ctaDemoHref}>
                  {hero.ctaDemo}
                  <span aria-hidden="true">→</span>
                </a>
                <a className="hero-beta-link" href={hero.ctaPrimaryHref}>
                  {hero.ctaPrimary}
                  <span aria-hidden="true">→</span>
                </a>
              </div>
              {hero.note.trim() ? (
                <EditableHtml as="p" copyId="hero.note" className="hero-note" html={hero.note} />
              ) : null}
            </div>
          </section>

          <section className="product-preview" aria-label="Podgląd możliwości Zecca na danych demonstracyjnych">
            <ProductCard className="value-card" label="Wartość portfela i historia wartości">
              <div className="product-card-head">
                <div>
                  <EditableHtml as="p" copyId="preview.value.kicker" className="product-kicker" html="Wartość portfela" />
                  <p className="product-value"><AnimatedCurrencyMetric value={snapshot.totalValue} /></p>
                  <p className="product-change">
                    <AnimatedPercentMetric value={totalReturn} /> <span>od początku</span>
                  </p>
                </div>
                <span className="demo-status"><span /> Dane demonstracyjne</span>
              </div>
              <StaticValueChart value={snapshot.valuationSeries} deposits={snapshot.netInvestedSeries} />
            </ProductCard>

            <div className="product-preview-secondary">
              <ProductCard className="allocation-card" label="Alokacja aktywów">
                <EditableHtml as="p" copyId="preview.allocation.kicker" className="product-kicker" html="Alokacja" />
                <EditableHtml as="p" copyId="preview.allocation.heading" className="product-heading" html="Struktura aktywów" />
                <StaticAllocationDonut slices={snapshot.allocation} />
              </ProductCard>

              <ProductCard className="portfolios-card" label="Portfele demonstracyjne">
                <EditableHtml as="p" copyId="preview.portfolios.kicker" className="product-kicker" html="Portfele" />
                <EditableHtml as="p" copyId="preview.portfolios.heading" className="product-heading" html="Podział na konta" />
                <div className="portfolio-preview-list">
                  {portfolios.map((portfolio, index) => {
                    const change = getThirtyDayChange(portfolio.sparkline);
                    const trend = createPortfolioTrend(change, index + 1);
                    const color = PORTFOLIO_COLORS[index] ?? PORTFOLIO_COLORS[0];
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
                          <SparklineSvg data={trend} color={color} />
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
              </ProductCard>
            </div>
          </section>
        </div>
      </header>

      <section className="trust-band" aria-label="Najważniejsze właściwości Zecca">
        <div className="wrap">
          <EditableHtml as="p" copyId="hero.proof" className="trust-proof" html={hero.proof} />
          <div className="trust-grid">
            {hero.trust.map((item, index) => (
              <div className="trust-item" key={item.title}>
                <TrustIcon index={index} />
                <div>
                  <p className="trust-item-title">{item.title}</p>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
