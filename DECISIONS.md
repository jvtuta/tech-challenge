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

## Contratos compartilhados

**Decisão:** pacote `@tech-challenge/contracts` com os tipos do contrato HTTP, o catálogo de
status e de tipos de transferência, os nomes dos tópicos e o envelope dos eventos
(`eventId`, `eventType`, `version`, `occurredAt`, `data`). O pacote é compilado para `dist` e
consumido pelos três apps como dependência de workspace.

**Alternativas consideradas:** duplicar os tipos em cada serviço; um schema registry (Avro
ou JSON Schema) para os eventos.

**Por quê:** produtor e consumidor precisam concordar sobre o formato, e no monorepo a forma
mais barata de garantir isso é o compilador: uma mudança de contrato quebra o `typecheck` de
quem depende dela no mesmo PR. O envelope carrega `eventId` para o consumidor descartar
duplicatas (entrega at-least-once do Kafka) e `version` para evoluir o payload sem quebrar
consumidores antigos. Um schema registry faria o mesmo com validação em runtime e evolução
formal de schema, mas é infraestrutura a mais para dois eventos e dois serviços.

## Modelagem de dados

**Decisão:** tabela `transactions` com `transaction_external_id` (UUID) como chave primária,
contas de débito e crédito como UUID, `value` em `DECIMAL(18,2)`, `status` como enum do banco
(`pending`, `approved`, `rejected`) e `transfer_type_id` referenciando a tabela
`transaction_types`, semeada pela própria migration. Índices compostos para as consultas do
dashboard: `(created_at)`, `(status, created_at)` e `(transfer_type_id, created_at)`.

**Alternativas consideradas:** id interno numérico separado do id externo; `value` em
inteiro de centavos ou em `FLOAT`; status como texto livre; tipos de transferência como enum
no código.

**Por quê:** o enunciado identifica a transação apenas pelo id externo, e ele já é único e
opaco; um segundo id só existiria para agradar o banco. `DECIMAL` evita erro de ponto
flutuante e mantém o valor legível no banco; centavos em inteiro seriam igualmente corretos,
mas espalham conversão por todo o código. O enum do banco impede um status inválido chegar
à tabela, e o conjunto de status é fechado pelo enunciado. Os tipos ficam em tabela porque o
contrato HTTP devolve `transactionType.name`; uma tabela permite novos tipos por dado, sem
deploy, e a migration semeia os iniciais para que o ambiente suba pronto. Os índices seguem
os filtros da listagem (status, tipo, período) sempre ordenada por data.
