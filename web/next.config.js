/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // The repo root carries its own package.json/package-lock.json (the
  // `sub-wave` CLI), so Next would otherwise infer the repo root as the
  // workspace root — destabilising module resolution and crashing the dev
  // server when it loads tailwind.config.js through the ESM loader. Pin the
  // root to this directory.
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
