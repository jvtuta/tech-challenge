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
e uma categoria semântica (`invalid`, `not-found`, `unavailable`), nunca um status HTTP. Um
filtro global em `shared/infrastructure/http` é o único lugar que traduz a categoria para o
status da resposta, com teste próprio. Erros que não pertencem a um módulo, como a falha ao
publicar um evento, vivem em `shared/application` e guardam a causa original pela opção
nativa do `Error`. Validação de formato fica no DTO com `class-validator`; validação de
regra fica no domínio (`TransactionValue`).

**Alternativas consideradas:** lançar `HttpException` do NestJS de dentro do caso de uso;
cada erro carregar o próprio status HTTP; validar tudo no DTO.

**Por quê:** o caso de uso não deve saber que existe HTTP; o mesmo código é chamado pelo
consumidor Kafka, onde `503` não significa nada, mas `unavailable` significa "tente de
novo" e `invalid` significa "descarte". O status dentro do erro foi a primeira versão e
vazava protocolo para dentro da aplicação; a categoria mantém a decisão de tradução num
único ponto da borda. Separar formato de regra evita que a regra de negócio dependa de
decorators e permite testá-la sem subir o Nest.

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

## Configuração vem do ambiente, lida por um único serviço

**Decisão:** cada serviço tem um `EnvConfigService` em `shared/infrastructure/env-config`,
sobre o `ConfigService` do `@nestjs/config`, com um getter nomeado por variável
(`getPort`, `getDatabaseUrl`, `getKafkaBrokers`, `getKafkaClientId`). Getters obrigatórios
lançam no boot nomeando a variável que falta; nenhum carrega valor padrão de host, porta ou
identificador. O `.env.example` do enunciado é a única fonte dos valores locais, e o módulo
procura o `.env` na raiz do monorepo porque cada app roda da própria pasta.

**Alternativas consideradas:** `process.env.X ?? 'localhost:9092'` em cada ponto de uso,
como estava; o mesmo serviço com valores padrão de desenvolvimento nos getters (`getPort()`
caindo em uma porta fixa, brokers caindo em `localhost`), como faço em outros serviços
meus; um schema `zod` aplicado a `process.env` no boot; um pacote de workspace só para
ler ambiente.

**Por quê:** o valor padrão em código é exatamente o host fixo que o PRACTICES.md
proíbe, e é silencioso: um ambiente mal configurado sobe apontando para `localhost` e só
falha quando a primeira mensagem não sai. Um valor padrão dentro do getter é a mesma
porta fixa, só que mais escondida: o serviço sobe, parece configurado, e ninguém sabe que
está usando o padrão. Nos meus outros serviços esse atalho existe para o ambiente de
desenvolvimento; aqui o `.env.example` já cumpre esse papel sem esconder nada, então os
getters obrigatórios não têm padrão algum. O serviço com getters nomeados é o padrão que eu
uso nos meus outros serviços: a interface lista tudo que o serviço precisa do ambiente,
cada getter é testado sem subir o Nest e quem injeta não sabe de onde o valor vem. O schema
`zod` faria a mesma validação com menos código, mas espalharia a leitura por quem consome;
um pacote próprio seria abstração para poucas linhas repetidas em dois serviços.

## Consumo dos eventos pelo transporte Kafka do NestJS

**Decisão:** cada serviço que consome sobe como aplicação híbrida: o HTTP de sempre mais o
transporte Kafka do `@nestjs/microservices` (`connectMicroservice` com `Transport.KAFKA`),
e os handlers são controllers com `@EventPattern`. A publicação continua pela porta
`EventPublisher` do pacote `@tech-challenge/messaging` (adapter KafkaJS), e toda mensagem
recebida passa por `parseEnvelope` antes de o handler ver qualquer coisa. No boot, o serviço
garante os tópicos pelo admin (`ensureTopics`, idempotente), porque o `subscribe` falha se o
tópico ainda não existe e o consumer pode subir antes do primeiro produtor. O antifraude é um
worker: consome `transaction.created`, aplica a regra e publica
`transaction.status.updated` com a mesma chave.

**Alternativas consideradas:** um consumer KafkaJS próprio no pacote de mensageria, com o
laço de consumo e a política de falha escritos à mão (foi a primeira versão desta PR);
provisionar os tópicos por script fora do serviço; validar o payload com um schema registry.

**Por quê:** o transporte do NestJS já faz o que o consumer próprio fazia (conexão, grupo,
assinatura, conversão do JSON) e documenta a semântica que importa: em `@EventPattern`, uma
exceção não tratada é retriable, o offset não é commitado e o broker reentrega. Manter
noventa linhas próprias para reproduzir isso seria código a mais para manter sem ganho.
O que o transporte não faz, e continua no código, é validar a forma do envelope e garantir
que o tópico exista antes de assinar. Criação de tópicos no boot serve ao ambiente local e
ao CI; em produção os tópicos seriam provisionados com partições e retenção definidas. Um
schema registry faria a validação em runtime com evolução formal, mas é infraestrutura a
mais para dois eventos cuja forma já é fixada em código pelo pacote de contratos.

## Falha no consumo: descartar o que está fora do contrato, reprocessar o resto

**Decisão:** o handler tem uma política só. Mensagem fora do contrato (JSON quebrado, tópico
desconhecido, versão diferente, payload sem os campos) é descartada e registrada em log, e o
handler retorna normalmente, então o offset avança. Erro lançado pelo handler (broker fora
ao publicar o veredito, por exemplo) sobe para o transporte, que o trata como retriable: o
offset não é commitado e a mensagem é reentregue. Não há fila de mensagens mortas nesta
entrega.

**Alternativas consideradas:** reprocessar tudo, inclusive mensagens malformadas; publicar
o que falhou em um tópico de mensagens mortas (DLQ) depois de N tentativas; capturar os
erros do handler e seguir.

**Por quê:** reprocessar JSON quebrado não conserta o JSON e trava a partição para sempre;
descartar com log é o único destino para ele. Já um erro do handler costuma ser
transitório, e reprocessar é o comportamento certo; engolir perderia vereditos. A DLQ é a
evolução natural para o caso em que um erro do handler não é transitório: ela separa a
mensagem envenenada sem travar a partição e permite reprocessar depois. Ficou de fora porque
exige um segundo tópico, um contador de tentativas e um processo de reprocessamento, e o
enunciado pede que o caminho triste exista e seja explicado, não que seja completo.

## Health do antifraude como readiness da dependência real

**Decisão:** `GET /health` do antifraude usa o Terminus com um único indicador, `kafka`,
que verifica pelo próprio transporte se o broker responde. O serviço não expõe nenhum outro
endpoint HTTP.

**Alternativas consideradas:** manter o `{ status: ok }` fixo; não expor HTTP algum no
worker; indicadores que não dizem respeito ao trabalho do serviço (ping HTTP externo, uso de
memória).

**Por quê:** um health fixo diz que o processo está vivo, não que ele consegue fazer o único
trabalho que tem, e para um consumer isso é alcançar o broker. Sem HTTP, Docker e Kubernetes
não teriam como saber. Indicadores alheios ao trabalho do serviço só acrescentam ruído.

## Atualização de status idempotente, a partir de `pending`

**Decisão:** o veredito do antifraude é aplicado pelo caso de uso `UpdateTransactionStatus`,
que carrega a transação e chama `settle(status)` no domínio. Só uma transação `pending`
muda; o mesmo veredito entregue de novo não altera nada e não grava; um veredito diferente
sobre uma transação já decidida é recusado (`TransactionAlreadySettledError`), porque o
primeiro veredito é o que valeu. No consumer Kafka do serviço de transações, o envelope é validado por
um pipe no `@Payload` e a categoria do erro decide o destino da mensagem em um único filter
(`DiscardEventFilter`), que vale para todos os handlers Kafka do serviço: erro de negócio determinístico (`invalid`, como o conflito;
`not-found`, depois de uma espera curta de três tentativas, porque o veredito pode chegar
antes de a gravação da transação ficar visível) é descartado com log; qualquer outro erro sobe
para o transporte reentregar.

**Alternativas consideradas:** sobrescrever o status a cada evento recebido; guardar os
`eventId` já processados em uma tabela e descartar repetidos antes de tocar na transação;
tratar conflito como sobrescrita pelo mais recente.

**Por quê:** o Kafka entrega ao menos uma vez, então a duplicata é caso normal, não exceção,
e a máquina de estados da transação já é a chave de idempotência: `pending` é o único estado
que aceita veredito, e o resultado da segunda entrega é idêntico ao da primeira. Uma tabela
de eventos processados resolve o mesmo problema com uma escrita a mais por mensagem e
limpeza periódica; ela passa a valer quando houver evento sem estado terminal para se apoiar.
Sobrescrever pelo mais recente faria uma reentrega fora de ordem reverter uma decisão, e a
recusa explícita deixa o conflito visível no log em vez de escondido. Reprocessar um erro
determinístico daria o mesmo resultado a cada tentativa e travaria a partição em uma única
mensagem; foi o que aconteceu no primeiro teste de ponta a ponta desta entrega, com vereditos
antigos para transações inexistentes, e é o motivo de a categoria do erro decidir o destino.

### A janela de visibilidade e o que a espera de três tentativas resolve

A criação publica `transaction.created` dentro da transação do banco (para que "Kafka recusou"
desfaça a gravação). O custo é uma janela de milissegundos em que o evento já saiu e a linha
ainda não foi commitada. Medido localmente, o veredito fica visível entre 10 e 40 ms depois
do `POST`, na mesma ordem de grandeza do commit; então a corrida entre o consumer de status e
o commit da criação é real. Sem tratamento, o veredito chega, o `SELECT` não acha a linha, o
erro é descartado e a transação fica pendente para sempre com o veredito perdido.

A espera de três tentativas com 250 ms cobre essa janela sem transformar um id inexistente em
mensagem envenenada. É uma mitigação, não a solução definitiva, e tem dois limites: um
`sleep` dentro do consumer segura o worker da partição enquanto espera, e os números são
fixos; um commit lento (lock, autovacuum, I/O) acima de 750 ms ainda perde o veredito, só que
raramente.

Dois caminhos resolvem o problema de fundo, e a escolha entre eles é o que mudaria com outros
requisitos: o outbox transacional (evento gravado na mesma transação da linha; um relay publica
depois do commit), que elimina a corrida e o "pendente sem evento" por construção, ao custo de
uma tabela, um relay e a limpeza dele; ou inverter a ordem, commit antes de publicar, e manter
um varredor que republica o `created` de transações pendentes há mais de N segundos, que aceita
a falha mas a torna recuperável com menos infraestrutura. Com o volume do enunciado, o varredor
bastaria; com volume alto e vários produtores, o outbox é o caminho.

## Listagem paginada por página, com limite de tamanho

**Decisão:** `GET /transactions` aceita `status`, `transferTypeId`, `from`, `to`, `page` e
`pageSize` (padrão 20, máximo 100) e devolve `{ items, page, pageSize, total }`, do mais
recente para o mais antigo. A consulta vive no read model, com `findMany` e `count` na mesma
transação do Prisma, e os filtros são exatamente os índices compostos criados na modelagem.

**Alternativas consideradas:** paginação por cursor (`createdAt` + id); devolver a lista sem
`total`; deixar `pageSize` sem limite.

**Por quê:** o dashboard mostra "página X de Y" e precisa do total; `offset` com `total` é o
que a tela pede e é barato no volume do enunciado. Cursor é mais estável sob inserção
concorrente e mais eficiente em páginas profundas, e é o caminho se o volume crescer, mas
não permite pular para uma página arbitrária, que é o que a interface oferece. O limite de
100 impede que um único pedido leia a tabela inteira. `total` na mesma transação garante
que a página e a contagem sejam do mesmo instante.
