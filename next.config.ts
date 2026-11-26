import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents is off: every page here is behind auth and reads the
  // session cookie, so pages are dynamic (see `export const dynamic` in
  // app/layout.tsx) and the cache-components model does not apply.
};

export default nextConfig;
