/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Doctor-share pages must never be indexed or cached (Phase 5 security).
  async headers() {
    return [
      {
        source: '/share/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
