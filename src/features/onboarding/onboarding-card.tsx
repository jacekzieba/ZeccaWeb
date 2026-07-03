"use client";

import { useState } from "react";
import { V2, V2_TYPE } from "@/lib/v2-design";

/** Full-screen dimmed modal card used by the onboarding intro and finale. */
export function OnboardingCard({
  eyebrow,
  title,
  body,
  image = null,
  dots,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  image?: { src: string; alt: string } | null;
  dots?: { count: number; active: number };
  footer: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [imageBroken, setImageBroken] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(20,26,21,.52)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(620px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: V2.card, borderRadius: 20,
          border: `0.5px solid ${V2.line}`,
          boxShadow: "0 18px 60px rgba(20,26,21,.35)",
          padding: "34px 38px", textAlign: "center",
          fontFamily: V2_TYPE.ui, color: V2.ink,
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: V2.subtle }}>
          {eyebrow}
        </div>
        <h2 style={{ fontFamily: V2_TYPE.serif, fontWeight: 400, fontSize: 30, lineHeight: 1.15, letterSpacing: "-.01em", marginTop: 12 }}>
          {title}
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: V2.muted, marginTop: 12 }}>{body}</p>

        {image && !imageBroken ? (
          // eslint-disable-next-line @next/next/no-img-element -- static onboarding asset with an onError fallback
          <img
            src={image.src}
            alt={image.alt}
            onError={() => setImageBroken(true)}
            style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginTop: 18 }}
          />
        ) : image ? (
          <div
            style={{
              marginTop: 18, height: 140, borderRadius: 12,
              border: `1.5px dashed ${V2.brand}55`, background: `${V2.brand}14`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: V2.brand, fontSize: 12, fontWeight: 600,
            }}
          >
            {image.alt}
          </div>
        ) : null}

        {children}

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>{footer}</div>

        {dots && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
            {Array.from({ length: dots.count }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === dots.active ? V2.brand : V2.line,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
