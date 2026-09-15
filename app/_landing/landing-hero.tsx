import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";
import { formatCurrency, formatPercent } from "@/lib/money";
import { AnimatedCurrencyMetric, AnimatedPercentMetric } from "./animated-metric";
import { AllocationRing } from "./allocation-ring";
import { landingCopy } from "./copy";
import { bindOrphans } from "./typo";
import { buildLandingDemoSnapshot } from "./landing-demo-data";
import { StaticValueChart } from "./static-value-chart";

// Kolory sparkline'ów portfeli — paleta landingu, nie tokeny aplikacji.
const PORTFOLIO_COLORS = ["#4FC79A", "#F0A43C"];

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
        <img className="hero-bg" src="/landing/depozyt/rondel.webp" alt="" aria-hidden="true" fetchPriority="high" />
        <div className="wrap hero-banner">
          <EditableHtml as="p" copyId="hero.betaBanner" className="beta-banner" html={hero.betaBanner} />
        </div>
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <EditableHtml as="span" copyId="hero.eyebrow" className="sec-kicker" html={hero.eyebrow} />
            <EditableHtml as="h1" copyId="hero.title" html={bindOrphans(hero.title)} />
            <EditableHtml as="p" copyId="hero.lede" className="lede" html={bindOrphans(hero.lede)} />
            <div className="hero-actions">
              <a className="btn btn-accent" href={hero.ctaPrimaryHref}>{hero.ctaPrimary}</a>
              <a className="btn btn-quiet" href={hero.ctaDemoHref}>{hero.ctaDemo}</a>
            </div>
            <p className="hero-sources">
              {[...hero.sources, "Liczone lokalnie"].join(" · ")}
            </p>
          </div>

          <aside className="hero-panel glass" aria-label="Wartość portfela demonstracyjnego">
            <div className="hero-panel-head">
              <span className="sec-kicker">Wartość portfela</span>
              <span className="src src-quiet">portfel demo</span>
            </div>
            <p className="product-value"><AnimatedCurrencyMetric value={snapshot.totalValue} /></p>
            <p className="product-change">
              <AnimatedPercentMetric value={totalReturn} /> <span>od pierwszej transakcji</span>
            </p>
            <StaticValueChart value={snapshot.valuationSeries} deposits={snapshot.netInvestedSeries} compact />
          </aside>
        </div>
      </header>

      <section className="register" id="rejestr" aria-label="Wartości portfela demonstracyjnego i ich źródła">
        <div className="wrap">
          <div className="sec-split">
            <div className="sec-head">
              <span className="sec-kicker">{hero.register.eyebrow}</span>
              <EditableHtml as="h2" copyId="hero.register.title" className="sec-title" html={bindOrphans(hero.register.title)} />
            </div>
          </div>

          <div className="register-grid">
            <div className="register-rows">
              {hero.register.rows.map((row, index) => (
                <div className="register-row" key={row.what}>
                  <p className="register-what">
                    {row.what} <b>{registerValues[index]}</b>
                  </p>
                  <span className="rail-mark">
                    {row.source}
                    <em>{row.detail}</em>
                  </span>
                </div>
              ))}
              <p className="register-note">{bindOrphans(hero.register.note)}</p>
            </div>

            <div className="register-visual">
              <ProductCard className="value-card" label="Historia wartości portfela demonstracyjnego">
                <div className="value-card-head">
                  <span className="sec-kicker">Historia wartości</span>
                  <span className="src">Portfel demo · bez konta</span>
                </div>
                <StaticValueChart value={snapshot.valuationSeries} deposits={snapshot.netInvestedSeries} />
              </ProductCard>

              <ProductCard className="portfolios-card" label="Portfele demonstracyjne">
                <span className="product-kicker">Portfele</span>
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
                  <span>Suma dwóch kont emerytalnych</span>
                  <b>{formatCurrency(portfolioPreviewTotal, "PLN")}</b>
                </div>
              </ProductCard>
            </div>
          </div>
        </div>
      </section>

      <section className="block asset-classes" id="klasy" aria-label="Obsługiwane klasy aktywów">
        <span className="sec-scrim" style={{ background: "radial-gradient(58% 58% at 21% 52%,rgba(240,164,60,.06),transparent 66%)" }} />
        <div className="wrap asset-classes-inner">
          <AllocationRing slices={snapshot.allocation} />
          <div>
            <span className="sec-kicker">{landingCopy.assetClasses.eyebrow}</span>
            <EditableHtml as="h2" copyId="assetClasses.title" className="sec-title" html={bindOrphans(landingCopy.assetClasses.title)} />
            <EditableHtml as="p" copyId="assetClasses.desc" className="sec-desc" html={bindOrphans(landingCopy.assetClasses.desc)} />
            <dl className="asset-rows">
              {landingCopy.assetClasses.rows.map((row) => (
                <div key={row.name}>
                  <dt>{row.name}</dt>
                  <dd className="micro">{row.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="micro asset-note">{bindOrphans(landingCopy.assetClasses.note)}</p>
          </div>
        </div>
      </section>

    </>
  );
}
