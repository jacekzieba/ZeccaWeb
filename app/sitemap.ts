import type { MetadataRoute } from "next";

const SITE_URL = "https://zecca.pl";
const LANDING_LAST_MODIFIED = new Date("2026-07-13");
const LAST_MODIFIED = new Date("2026-07-02");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: LANDING_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy-policy`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
