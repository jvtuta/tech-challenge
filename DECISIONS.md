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

## Publicação de eventos com interface fluente

**Decisão:** os casos de uso publicam eventos por uma interface fluente do pacote
`@tech-challenge/messaging`: `dispatch(publisher).event(tópico).keyedBy(id).with(dados).publish()`.
A porta `EventPublisher` recebe a mensagem pronta (tópico, chave e envelope); o adapter
concreto (Kafka em produção, memória nos testes) é escolhido pelo módulo de cada serviço.

**Alternativas consideradas:** chamar o producer do KafkaJS direto no caso de uso; o
`EventBus` do `@nestjs/cqrs` com handlers que republicam no Kafka; uma função
`publish(topic, key, data)`.

**Por quê:** a chave da mensagem é a decisão mais importante do fluxo, porque é ela que
mantém os eventos de uma transação em ordem na mesma partição, e no producer do KafkaJS ela é
opcional e fácil de esquecer. Na interface fluente a chave é obrigatória por construção e o
tipo do payload é verificado por tópico em tempo de compilação. O `EventBus` do NestJS
resolveria o desacoplamento, mas introduziria uma segunda máquina de eventos, em processo,
para explicar ao lado da do Kafka. Uma função simples bastaria funcionalmente; a forma fluente
foi escolhida porque lê como a regra de negócio nos casos de uso e nos testes, e porque o
publisher em memória permite testar o caminho triste (broker fora) sem infraestrutura.

## Criação de transação: gravar e publicar na mesma unidade de trabalho

**Decisão:** `POST /transactions` grava a transação como `pending` e publica
`transaction.created` dentro da mesma transação do banco. Se a publicação falhar, a gravação é
desfeita e o cliente recebe `503` com o código `EVENT_PUBLISH_FAILED`. O caso de uso depende
de três portas (`TransactionRepository`, `UnitOfWork`, `EventPublisher`) e é testado com
adapters em memória, inclusive o caminho em que o broker está fora.

**Alternativas consideradas:** gravar e depois publicar sem transação, aceitando que uma falha
deixe a transação pendente para sempre; outbox transacional, com uma tabela de eventos
pendentes e um relay publicando em segundo plano; publicar primeiro e gravar depois.

**Por quê:** uma transação `pending` que o antifraude nunca vai avaliar é o pior estado
possível para o cliente, porque parece válida e nunca muda. Recusar a criação é honesto e
imediato. O outbox é a solução mais robusta (sobrevive a quedas entre gravar e publicar sem
segurar a transação do banco) e é o próximo passo natural se a taxa de falha do broker
justificar; hoje custaria uma tabela, um relay e a limpeza dele para um cenário que a
transação do banco já cobre. Publicar antes de gravar geraria eventos para transações que
podem não existir.

## Leituras fora dos casos de uso

**Decisão:** consultas (`TransactionQueries`) leem o Prisma direto e devolvem o contrato
HTTP pronto, sem passar pela entidade. Os casos de uso existem só para escritas, onde há
invariante e evento.

**Alternativas consideradas:** um caso de uso por operação, inclusive `GET`; reaproveitar o
repositório de escrita para as consultas.

**Por quê:** uma consulta não tem regra de negócio: um caso de uso ali só repassaria a chamada.
O repositório de escrita hidrata a entidade para aplicar regras; a listagem paginada não
precisa disso e pagar a hidratação por linha de dashboard seria custo sem função. Se entrar
autorização por conta, ela é regra, e aí um caso de uso de leitura passa a fazer sentido.

## Erros de negócio sem exceções do framework

**Decisão:** domínio e aplicação lançam subclasses de `DomainError`, que carregam um código
e o status HTTP; um filtro global na borda traduz para a resposta. Validação de formato fica
no DTO com `class-validator`; validação de regra fica no domínio (`TransactionValue`).

**Alternativas consideradas:** lançar `HttpException` do NestJS de dentro do caso de uso;
validar tudo no DTO.

**Por quê:** o caso de uso não deve saber que existe HTTP; o mesmo código será chamado pelo
consumidor Kafka, onde `503` não significa nada. Separar formato de regra evita que a regra
de negócio dependa de decorators e permite testá-la sem subir o Nest.

## Regra antifraude como função pura

**Decisão:** a avaliação é uma função pura em `apps/anti-fraud`, `evaluateTransaction`, que
recebe o que o evento carrega (id e valor) e devolve `approved` ou `rejected`. O limite de
1000 é uma constante de negócio nomeada (`APPROVAL_LIMIT`), com a fronteira coberta por teste
(999.99, 1000 e 1000.01). O consumidor Kafka só faz ler o evento, chamar a função e publicar
o veredito.

**Alternativas consideradas:** colocar a regra dentro do handler do consumidor; ler o limite de
variável de ambiente; modelar a regra como serviço injetável do NestJS.

**Por quê:** a regra é a única coisa que o serviço antifraude sabe, e é o que mais vale testar
sem subir infraestrutura. Dentro do handler ela ficaria acoplada ao parse da mensagem e ao
producer. O limite não é configuração de ambiente (como host ou credencial), é regra do
negócio dada pelo enunciado: mudar o valor é uma decisão de produto, e tem que passar por
código e teste. Um serviço injetável só acrescentaria decorator a uma função de uma linha.

## Testes de ponta a ponta contra o banco real

**Decisão:** a suíte de ponta a ponta do serviço de transações sobe o `AppModule` inteiro
com supertest contra um PostgreSQL real, com a tabela limpa antes de cada caso, e substitui
apenas o publisher de eventos por uma implementação em memória. O CI sobe o Postgres como
serviço e aplica as migrations antes de rodar exatamente o mesmo `pnpm quality` da máquina
local. A configuração da borda (validação e filtro de erros) é uma função compartilhada entre
o `main.ts` e os testes.

**Alternativas consideradas:** mockar o Prisma nos testes de ponta a ponta; usar
Testcontainers para subir o banco de dentro do Jest; subir também o Kafka nesta suíte.

**Por quê:** o comportamento que mais importa provar aqui é a transação do banco desfazendo a
gravação quando o evento não sai, e um mock do Prisma não prova nada sobre isso. O banco
como serviço do CI é mais simples e mais rápido que Testcontainers para um único banco, e o
`docker-compose.yml` do enunciado já dá o mesmo ambiente localmente. O Kafka fica fora desta
suíte porque o assunto dela é o serviço HTTP; o fluxo com o broker real tem a sua própria
suíte junto com os consumidores. A configuração da borda é compartilhada para que o teste
não passe com um pipe ou filtro diferente do que roda em produção.
