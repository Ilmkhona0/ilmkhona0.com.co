import type { MetadataRoute } from "next";

const SITE = "https://ilmkhona0.com.co";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/auth`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  for (const folder of ["images", "videos", "apps", "games", "files"]) {
    routes.push({
      url: `${SITE}/category/${folder}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return routes;
}
