import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

// O `.env` do enunciado fica na raiz do monorepo e o Next só carrega os do diretório do app,
// então `NEXT_PUBLIC_API_URL` não chegava ao bundle em um clone novo. Mesmo caminho relativo
// que o `EnvConfigModule` dos serviços usa, porque cada app roda da própria pasta. O que já
// estiver definido (shell, ou um `.env` do próprio app) continua ganhando.
const rootEnvFile = join(process.cwd(), '..', '..', '.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  eslint: {
    // O lint roda uma vez na raiz do workspace (`pnpm lint`), com a config compartilhada.
    // Repetir no build só duplicaria a etapa e não enxergaria a config da raiz.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
