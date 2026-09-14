# Decisões de arquitetura

Registro das decisões estruturantes do projeto, na ordem em que foram tomadas. Cada entrada
diz o que foi decidido, o que mais foi considerado e por quê. Ao final, a resposta sobre volume
alto de escritas e leituras concorrentes.

## Organização do projeto

**Decisão:** monorepo com pnpm workspaces: `apps/transactions`, `apps/anti-fraud`, `apps/web`
e `packages/*` para contratos compartilhados. Sem Turborepo ou Nx.

**Alternativas consideradas:** um repositório por serviço; monorepo com Turborepo.

**Por quê:** os três serviços compartilham o contrato dos eventos e o ciclo de vida do
desafio. Um único `pnpm quality` e um único CI cobrem tudo, e uma mudança de contrato é
revisada no mesmo PR que muda produtor e consumidor. Repositórios separados exigiriam publicar
o pacote de contratos para sincronizar. Turborepo traria cache e paralelismo, mas com três
pacotes pequenos o ganho não paga a camada extra de configuração para explicar.

## Ferramentas de qualidade na raiz

**Decisão:** ESLint (flat config), Prettier, Jest e TypeScript configurados uma vez na raiz;
cada app só declara o que é específico dele (`tsconfig` estende `tsconfig.base.json`, regras
do Next.js aplicadas apenas a `apps/web`). `any` é erro de lint, não aviso.

**Alternativas consideradas:** configuração por app, como os geradores do NestJS e do Next.js
entregam por padrão.

**Por quê:** três cópias da mesma regra divergem com o tempo, e o pre-commit precisa de um
único comando para os arquivos alterados. O custo é um bloco de compatibilidade para as regras
do Next.js, que ainda não publicam flat config nativa na versão 15.

## Testes com Jest

**Decisão:** Jest em todos os apps, com `ts-jest` no NestJS e `next/jest` mais Testing Library
no dashboard. Cada app expõe `test`; a raiz agrega.

**Alternativas consideradas:** Vitest.

**Por quê:** Jest é o padrão do NestJS e do Next.js, dispensa configuração de decorators e é
a ferramenta que a equipe já usa. Vitest é mais rápido, mas exige SWC para
`emitDecoratorMetadata` no NestJS; a velocidade não compensa mais uma peça para manter em um
projeto deste tamanho.

## Quality gate e hooks

**Decisão:** `pnpm quality` executa `lint`, `typecheck`, `format:check`, `test` e `build`,
nessa ordem, e cada etapa também existe isolada. O `husky` roda `lint-staged` (ESLint e
Prettier nos arquivos alterados) no `pre-commit` e `commitlint` no `commit-msg`. O CI executa
exatamente `pnpm quality`.

**Alternativas consideradas:** `lefthook`; rodar só o lint no CI e os testes em outro job.

**Por quê:** o que falha localmente tem que falhar no CI, e vice-versa. Um único comando
garante isso por construção. `husky` é a opção que a equipe já conhece; `lefthook` é mais
rápido em repositórios grandes, o que não é o caso aqui.
