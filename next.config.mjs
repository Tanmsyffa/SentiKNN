/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    lockDistDir: false,
  },
  async rewrites() {
    // On Vercel, Python serverless functions are served natively from /api/*.py.
    // In local development, Next.js can proxy to local Flask if needed.
    if (process.env.VERCEL) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: process.env.PYTHON_API_URL || 'http://localhost:5000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
