import type { MetadataRoute } from "next";

const SITE_URL = "https://zecca.pl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/dashboard",
        "/portfolios",
        "/positions",
        "/transactions",
        "/instruments",
        "/earnings",
        "/benchmark",
        "/reports",
        "/import",
        "/settings",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
