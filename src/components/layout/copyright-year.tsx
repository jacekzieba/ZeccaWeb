"use client";

import { useEffect, useState } from "react";

// `/faq` and `/privacy-policy` are statically prerendered, so a plain
// `new Date().getFullYear()` in a server component freezes at build time and
// goes stale after a year rollover without a redeploy. Isolating just the
// year in a client component lets it self-correct on load without making the
// rest of the footer (links, hover) ship any JS.
export function CopyrightYear() {
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return <>{year}</>;
}
