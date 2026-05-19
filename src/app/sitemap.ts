import type { MetadataRoute } from "next";
import { POPULAR_HANDLES, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
  const handleRoutes: MetadataRoute.Sitemap = POPULAR_HANDLES.map((h) => ({
    url: `${SITE_URL}/u/${h}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.5,
  }));
  return [...staticRoutes, ...handleRoutes];
}
