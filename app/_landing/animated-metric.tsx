"use client";

import { formatCurrency, formatPercent } from "@/lib/money";
import { useCountUp } from "./use-count-up";

export function AnimatedCurrencyMetric({ value }: { value: number }) {
  const animatedValue = useCountUp(value);
  const finalValue = formatCurrency(Math.round(value), "PLN");

  return (
    <>
      <span aria-hidden="true">{formatCurrency(Math.round(animatedValue), "PLN")}</span>
      <span className="sr-only">{finalValue}</span>
    </>
  );
}

export function AnimatedPercentMetric({ value }: { value: number }) {
  const animatedValue = useCountUp(value, 950);
  const prefix = value >= 0 ? "+" : "";

  return (
    <>
      <span aria-hidden="true">{prefix}{formatPercent(animatedValue)}</span>
      <span className="sr-only">{prefix}{formatPercent(value)}</span>
    </>
  );
}
