export type SiteVariant = "stable" | "preview";

const rawVariant = (import.meta.env.PUBLIC_SITE_VARIANT || "stable").toLowerCase();
export const siteVariant: SiteVariant = rawVariant === "preview" ? "preview" : "stable";

export const stableSiteUrl =
  import.meta.env.PUBLIC_STABLE_SITE_URL || "https://omegon.styrene.io";
export const previewSiteUrl =
  import.meta.env.PUBLIC_PREVIEW_SITE_URL || "https://omegon.styrene.dev";
export const currentSiteUrl = import.meta.env.PUBLIC_SITE_URL ||
  (siteVariant === "preview" ? previewSiteUrl : stableSiteUrl);

export const canonicalSiteUrl = stableSiteUrl;
export const isPreviewSite = siteVariant === "preview";
export const isStableSite = siteVariant === "stable";

export const installBaseUrl = isPreviewSite ? previewSiteUrl : stableSiteUrl;
export const installScriptUrl = `${installBaseUrl}/install.sh`;
