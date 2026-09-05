/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // These packages (and their dependency chains) use dynamic require()
    // calls that Next's webpack bundler can't statically analyze. Marking
    // them external tells Next to load them natively at runtime instead of
    // trying to bundle them -- they're only ever used server-side anyway.
    serverComponentsExternalPackages: [
      'playwright-core',
      'playwright-extra',
      'puppeteer-extra-plugin-stealth',
    ],
  },
};

module.exports = nextConfig;