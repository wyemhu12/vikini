// /next.config.js
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Next.js 16: Turbopack is enabled by default.
  // Add an explicit (even empty) turbopack config to avoid build error when webpack config exists.
  turbopack: {},

};

module.exports = nextConfig;
