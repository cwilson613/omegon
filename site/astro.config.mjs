import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://omegon.styrene.dev",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
    },
  },
  // Output static HTML — no SSR
  output: "static",
});
