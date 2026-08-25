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
  const metrics = snapshot.metrics;
  const totalReturn = metrics.totalReturnPct;
  const portfolios = snapshot.portfolios.slice(0, 2);
  const portfolioPreviewTotal = portfolios.reduce((total, portfolio) => total + portfolio.value, 0);

  // Wiersz rejestru = wartość policzona z danych demo + cecha jej źródła.
  // Wartości biorą się z tego samego silnika co w aplikacji, więc nie ma tu
  // ani jednej liczby wpisanej ręcznie.
  const registerValues = [
    formatCurrency(snapshot.totalValue, "PLN"),
    formatPercent(metrics.realReturnPct),
    metrics.xirrPct === null ? "—" : formatPercent(metrics.xirrPct),
    formatCurrency(metrics.unrealizedPnl, "PLN"),
    formatCurrency(metrics.netInvested, "PLN"),
  ];

  return (
    <>
      <header className="hero" id="top">
        {/* Pasek bety stoi nad szyną, nie na niej — to komunikat o stanie
            produktu, a nie cecha żadnej liczby. */}
        <div className="wrap hero-banner">
          <EditableHtml as="p" copyId="hero.betaBanner" className="beta-banner" html={hero.betaBanner} />
        </div>
        <div className="wrap">
          <div className="rail-row hero-open">
            <EditableHtml as="span" copyId="hero.eyebrow" className="rail-mark" html={hero.eyebrow} />
            <div className="rail-body">
              <EditableHtml as="h1" copyId="hero.title" html={hero.title} />
              <EditableHtml as="p" copyId="hero.lede" className="lede" html={hero.lede} />
              <div className="hero-actions">
                <a className="btn btn-accent" href={hero.ctaDemoHref}>{hero.ctaDemo}</a>
                <a className="btn-quiet" href={hero.ctaPrimaryHref}>{hero.ctaPrimary}</a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="register" id="rejestr" aria-label="Rejestr wartości portfela demonstracyjnego">
        <div className="wrap">
          {hero.register.rows.map((row, index) => (
            <div className="rail-row register-row" key={row.what}>
              <span className="rail-mark">
                {row.source}
                <em>{row.detail}</em>
              </span>
              <p className="register-what">
                {row.what} <b>{registerValues[index]}</b>
              </p>
            </div>
          ))}
          <div className="rail-row">
            <span className="rail-mark" aria-hidden="true" />
            <p className="register-note">{hero.register.note}</p>
          </div>
        </div>
      </section>

      <section className="preview" id="podglad" aria-label="Podgląd możliwości Zecca na danych demonstracyjnych">
        <div className="wrap">
          <div className="rail-row">
            <span className="rail-mark">
              Portfel demo
              <em>bez kont i logowania</em>
            </span>
            <div className="preview-body">
              <ProductCard className="value-card" label="Wartość portfela i historia wartości">
                <div className="product-card-head">
                  <div>
                    <EditableHtml as="p" copyId="preview.value.kicker" className="product-kicker" html="Wartość portfela" />
                    <p className="product-value"><AnimatedCurrencyMetric value={snapshot.totalValue} /></p>
                    <p className="product-change">
                      <AnimatedPercentMetric value={totalReturn} /> <span>od początku</span>
                    </p>
                  </div>
                </div>
                <StaticValueChart value={snapshot.valuationSeries} deposits={snapshot.netInvestedSeries} />
              </ProductCard>

              <div className="preview-split">
                <ProductCard className="allocation-card" label="Alokacja aktywów">
                  <EditableHtml as="p" copyId="preview.allocation.kicker" className="product-kicker" html="Alokacja" />
                  <StaticAllocationDonut slices={snapshot.allocation} />
                </ProductCard>

                <ProductCard className="portfolios-card" label="Portfele demonstracyjne">
                  <EditableHtml as="p" copyId="preview.portfolios.kicker" className="product-kicker" html="Portfele" />
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
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
