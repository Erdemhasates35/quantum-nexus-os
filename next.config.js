/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  api: {
    bodyParser: { sizeLimit: '2mb' },
    responseLimit: '8mb'
  }
};

module.exports = nextConfig;
