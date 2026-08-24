import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@poker/engine', '@poker/protocol'],
};
export default config;
