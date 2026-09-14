import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // O lint roda uma vez na raiz do workspace (`pnpm lint`), com a config compartilhada.
    // Repetir no build só duplicaria a etapa e não enxergaria a config da raiz.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
