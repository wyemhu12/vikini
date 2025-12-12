// /next.config.js
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ❌ Tắt Turbopack hoàn toàn
  experimental: {
    turbo: false,
  },

  webpack: (config) => {
    // Alias @ → root dir
    config.resolve.alias["@"] = path.resolve(__dirname);
    return config;
  },
};

module.exports = nextConfig;
