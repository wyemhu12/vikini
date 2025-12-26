/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/features/chat",
        permanent: false, // dùng false cho redirect kiểu logic app
      },
      {
        source: "/gems",
        destination: "/features/gems",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
