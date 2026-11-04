/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the Vercel API can deploy the built `out/` folder
  // as a plain static site, with no server or native binary needed.
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['three'],
};

export default nextConfig;
