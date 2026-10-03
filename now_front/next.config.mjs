/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // /en·/zh·/ja 루트는 별도 홈이 없어 404가 나던 문제 — 앱 홈을 해당 언어로 연다(2026-10-04)
  async redirects() {
    return [
      { source: '/en', destination: '/?lang=en', permanent: false },
      { source: '/zh', destination: '/?lang=zh', permanent: false },
      { source: '/ja', destination: '/?lang=ja', permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api-now/:path*',
        destination: 'http://127.0.0.1:8081/:path*',
      },
    ];
  },
};

export default nextConfig;
