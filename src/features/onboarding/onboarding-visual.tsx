import { Laptop, LockKeyhole, Smartphone, Tablet } from "lucide-react";
import { V2, V2_TYPE } from "@/lib/v2-design";

type IntroVisual = "portfolio" | "privacy";

const visualStyles = `
  @keyframes onboarding-chart-draw {
    from { stroke-dashoffset: 260; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes onboarding-chart-fill {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .onboarding-visual * { animation: none !important; }
  }
`;

function PortfolioVisual() {
  return (
    <div aria-label="Animowany podgląd wyniku i struktury portfela" role="img" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(150px, 1fr)" }}>
      <div style={{ minWidth: 0, padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: V2.subtle, letterSpacing: ".11em", textTransform: "uppercase" }}>Twój portfel</div>
            <div style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.04em", marginTop: 4 }}>248 920 zł</div>
          </div>
          <div style={{ color: V2.profit, background: "rgba(35,129,79,.12)", borderRadius: 99, padding: "5px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
            +12,4%
          </div>
        </div>
        <svg viewBox="0 0 360 118" style={{ display: "block", width: "100%", height: 112, marginTop: 8 }} aria-hidden="true">
          <defs>
            <linearGradient id="onboarding-chart-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={V2.profit} stopOpacity=".24" />
              <stop offset="100%" stopColor={V2.profit} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[26, 58, 90].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke={V2.line2} />)}
          <path d="M0 105 L0 86 L38 82 L72 88 L111 65 L146 72 L181 50 L215 58 L250 33 L287 42 L322 18 L352 11 L352 105 Z" fill="url(#onboarding-chart-gradient)" style={{ animation: "onboarding-chart-fill 900ms ease-out both" }} />
          <path d="M0 86 L38 82 L72 88 L111 65 L146 72 L181 50 L215 58 L250 33 L287 42 L322 18 L352 11" fill="none" stroke={V2.profit} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" pathLength="260" strokeDasharray="260" style={{ animation: "onboarding-chart-draw 1.7s cubic-bezier(.2,.8,.2,1) both" }} />
          <circle cx="352" cy="11" r="4.5" fill={V2.profit} />
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", color: V2.subtle, fontSize: 9, fontWeight: 700, letterSpacing: ".08em" }}>
          <span>1R</span><span>3L</span><span>5L</span><span>MAX</span>
        </div>
      </div>
      <div style={{ borderLeft: `1px solid ${V2.line}`, padding: "18px 14px", minWidth: 0 }}>
        <div style={{ color: V2.subtle, fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Struktura aktywów</div>
        <svg viewBox="0 0 100 100" style={{ display: "block", width: 86, height: 86, margin: "8px auto 5px" }} aria-hidden="true">
          <circle cx="50" cy="50" r="35" fill="none" stroke={V2.line2} strokeWidth="14" />
          <circle cx="50" cy="50" r="35" fill="none" stroke={V2.equity} strokeWidth="14" pathLength="100" strokeDasharray="44 56" strokeDashoffset="0" transform="rotate(-90 50 50)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke={V2.bonds} strokeWidth="14" pathLength="100" strokeDasharray="26 74" strokeDashoffset="-46" transform="rotate(-90 50 50)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke={V2.deposit} strokeWidth="14" pathLength="100" strokeDasharray="18 82" strokeDashoffset="-74" transform="rotate(-90 50 50)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke={V2.crypto} strokeWidth="14" pathLength="100" strokeDasharray="10 90" strokeDashoffset="-94" transform="rotate(-90 50 50)" />
        </svg>
        <div style={{ display: "grid", gap: 4, color: V2.muted, fontSize: 9.5, fontWeight: 600 }}>
          <span><i style={{ display: "inline-block", width: 6, height: 6, marginRight: 5, borderRadius: "50%", background: V2.equity }} />Akcje i ETF-y <b>44%</b></span>
          <span><i style={{ display: "inline-block", width: 6, height: 6, marginRight: 5, borderRadius: "50%", background: V2.bonds }} />Obligacje <b>26%</b></span>
          <span><i style={{ display: "inline-block", width: 6, height: 6, marginRight: 5, borderRadius: "50%", background: V2.deposit }} />Lokaty i gotówka <b>18%</b></span>
          <span><i style={{ display: "inline-block", width: 6, height: 6, marginRight: 5, borderRadius: "50%", background: V2.crypto }} />Kryptowaluty <b>12%</b></span>
        </div>
      </div>
    </div>
  );
}

function PrivacyVisual() {
  return (
    <div
      aria-label="Szyfrowane dane dostępne tylko na Twoich urządzeniach"
      role="img"
      style={{ height: 212, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
    >
      <div style={{ position: "absolute", width: 310, height: 1, background: V2.line, top: "50%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 54, position: "relative" }}>
        <div style={{ width: 88, height: 74, display: "grid", placeItems: "center", color: V2.brand, background: V2.card, border: `1px solid ${V2.line}`, borderRadius: 14, boxShadow: `0 8px 24px ${V2.line2}` }}>
          <Laptop size={43} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div style={{ width: 76, height: 76, display: "grid", placeItems: "center", color: V2.onBrand, background: V2.brand, borderRadius: "50%", boxShadow: `0 10px 28px ${V2.line}` }}>
          <LockKeyhole size={31} strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div style={{ width: 88, height: 74, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: V2.brand, background: V2.card, border: `1px solid ${V2.line}`, borderRadius: 14, boxShadow: `0 8px 24px ${V2.line2}` }}>
          <Tablet size={37} strokeWidth={1.5} aria-hidden="true" />
          <Smartphone size={30} strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function OnboardingVisual({ visual }: { visual: IntroVisual }) {
  return (
    <div className="onboarding-visual" style={{ marginTop: 18, overflow: "hidden", borderRadius: 12, border: `1px solid ${V2.line}`, background: V2.card2, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <style>{visualStyles}</style>
      {visual === "portfolio" ? <PortfolioVisual /> : <PrivacyVisual />}
    </div>
  );
}
