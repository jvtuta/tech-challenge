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
a ferramenta que eu já uso. Vitest é mais rápido, mas exige SWC para
`emitDecoratorMetadata` no NestJS; a velocidade não compensa mais uma peça para manter em um
projeto deste tamanho.

## Quality gate e hooks

**Decisão:** `pnpm quality` executa `lint`, `typecheck`, `format:check`, `test` e `build`,
nessa ordem, e cada etapa também existe isolada. O `husky` roda `lint-staged` (ESLint e
Prettier nos arquivos alterados) no `pre-commit` e `commitlint` no `commit-msg`. O CI executa
exatamente `pnpm quality`.

**Alternativas consideradas:** `lefthook`; rodar só o lint no CI e os testes em outro job.

**Por quê:** o que falha localmente tem que falhar no CI, e vice-versa. Um único comando
garante isso por construção. `husky` é a opção que eu já uso; `lefthook` é mais
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

## Criação de transação: commit antes de publicar, com varredor de pendentes

**Decisão:** `POST /transactions` grava a transação como `pending` em uma transação curta do
banco e, só depois do commit, publica `transaction.created`. Se a publicação falhar, o cliente
recebe `201` mesmo assim, com aviso no log; um varredor periódico (a cada 5 s) republica o
evento das transações que continuam pendentes há mais de 10 s. O caso de uso depende de três
portas (`TransactionRepository`, `UnitOfWork`, `EventPublisher`) e é testado com adapters em
memória, inclusive com o broker recusando.

**Alternativas consideradas:** publicar dentro da transação do banco, desfazendo a gravação se
o broker recusar (foi a primeira versão desta entrega); outbox transacional, com o evento
gravado na mesma transação e um relay publicando depois; CDC sobre o log do banco.

**Por quê:** a primeira versão garantia "nunca pendente sem evento", mas com dois custos que
medi: a transação ficava aberta enquanto o KafkaJS tentava publicar (12 s com o broker fora),
então poucas requisições com broker lento prendiam o pool inteiro; e o evento saía antes do
commit, abrindo uma janela em que o veredito do antifraude (10 a 40 ms depois do `POST`)
podia chegar antes de a linha ficar visível. Commitar antes de publicar fecha as duas coisas
por construção: o broker nunca segura uma conexão e a linha sempre existe quando o evento sai.
O que sobra é "pendente sem evento" quando a publicação falha, e o varredor cobre isso em
segundos, sem tabela nova, reusando o índice `(status, created_at)` da modelagem. Um evento
republicado a mais é inócuo porque a regra do antifraude é determinística e o consumer de
status só muda o que está pendente. O outbox faz o mesmo com uma fila própria e recuperação em
milissegundos, ao custo de tabela, relay e retenção; é o próximo passo quando o volume
justificar. O producer passa a tentar pouco (duas tentativas curtas, conexão com limite de 1 s): quem
publica já gravou o que tinha que gravar, e a recuperação é do varredor; medido, o `POST` com
o broker fora caiu de 12,5 s para cerca de 300 ms. Os 10 s do corte são uma ordem de
grandeza acima do pior caso medido de veredito e das tentativas do producer; os 5 s do
intervalo mantêm a recuperação curta sem pesar na tabela.

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

## Falha no consumo: descartar, reprocessar com teto e desistir para o varredor

**Decisão:** o handler tem uma política só, com três saídas. Mensagem fora do contrato (JSON
quebrado, tópico desconhecido, versão diferente, payload sem os campos) e erro de negócio
determinístico são descartados com log de aviso, e o handler retorna normalmente, então o
offset avança. Erro que pode ser transitório (banco fora, broker fora ao publicar o veredito)
sobe para o transporte, que não commita o offset e reentrega a mensagem. A partir da terceira
entrega do mesmo offset, o filtro desiste: registra log de erro e deixa o offset avançar. A
contagem é por partição, dentro do processo, e vive no `RedeliveryBudget` do pacote de
mensageria; o offset em curso é um só por partição, então o mapa não cresce. Não há fila de
mensagens mortas nesta entrega.

**Alternativas consideradas:** reprocessar tudo para sempre, inclusive mensagens
malformadas, que era o comportamento anterior; publicar o que falhou em um tópico de
mensagens mortas (DLQ) depois de N tentativas; capturar os erros do handler e seguir;
contar as tentativas em um cabeçalho da mensagem, republicando no mesmo tópico.

**Por quê:** reprocessar JSON quebrado não conserta o JSON e trava a partição para sempre;
descartar com log é o único destino para ele. Já um erro de infraestrutura costuma ser
transitório, e reentregar é o comportamento certo, mas sem teto ele tem o mesmo fim do JSON
quebrado: uma dependência fora do ar por minutos prende a partição inteira, e os eventos das
outras transações ficam atrás dela na fila. Três entregas cobrem a oscilação curta,
reconexão do banco ou rebalanceamento do grupo; o que não passa em três não é oscilação.
Desistir é seguro aqui por causa do varredor: a transação continua pendente, e a cada 5
segundos o serviço de transações republica o `transaction.created` das pendentes com mais de
10 segundos, o que refaz o veredito e traz o evento de volta por um caminho que não depende
daquele offset. O custo de desistir cedo é, no pior caso, a soma da carência com o intervalo
do varredor: com o banco fora e o veredito em voo, o filtro desistiu da mensagem em 3
segundos em vez de prender a partição, e a transação foi aprovada na primeira passada do
varredor depois que o banco voltou. O contador em memória é suficiente porque a reentrega também é do processo: se
ele reiniciar, o grupo reprocessa a partir do último offset commitado e o orçamento recomeça,
que é o que se quer. A DLQ continua sendo a evolução natural, para quando houver o que fazer
com a mensagem descartada além do log, e o cabeçalho de tentativas seria o caminho se a
contagem precisasse sobreviver ao processo, ao custo de republicar a mensagem e perder a
ordem dentro da partição.

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
`not-found`, um id que nunca existiu) é descartado com log; qualquer outro erro sobe
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

Com o commit antes da publicação, o veredito não pode chegar antes de a linha existir;
`not-found` no consumer de status passa a significar um id que nunca existiu, e é descartado.

## Listagem paginada por página, com limite de tamanho, por um repositório pesquisável

**Decisão:** `GET /transactions` aceita `status`, `transferTypeId`, `from`, `to`, `page`,
`pageSize` (padrão 20, máximo 100), `sort` (`createdAt` ou `value`) e `sortDir`, e devolve
`{ items, page, pageSize, total }`, do mais recente para o mais antigo quando não há
ordenação pedida. A consulta segue o contrato de repositório pesquisável que mantenho em
`shared/domain/searchable-repository.ts`: `SearchParams<Filter>` normaliza página, tamanho,
ordenação e filtro; `SearchResult<Item, Filter>` carrega os itens, o total e a última página;
quem implementa `SearchableRepository` declara `sortableFields` e expõe `search(params)`. O
read model `TransactionQueries` implementa esse contrato traduzindo o filtro para o `where` do
Prisma (só o que veio preenchido, cada campo casando com um índice composto da modelagem) e
a ordenação para o `orderBy` (campo fora de `sortableFields` cai no padrão). O controller monta
os `SearchParams` a partir do DTO validado e devolve o `SearchResult` no contrato HTTP.

**Alternativas consideradas:** paginação por cursor (`createdAt` + id); devolver a lista sem
`total`; deixar `pageSize` sem limite; manter a listagem como um método ad hoc do read model,
com página, filtro e ordenação lidos direto da query string.

**Por quê:** o repositório pesquisável é um padrão que uso nos projetos NestJS em que trabalho
(está no Lexxen Pay e no CRM da Klevr, sobre a mesma base que gerou este esqueleto): toda
listagem tem a mesma forma de entrada e de saída, os campos ordenáveis são declarados no
repositório em vez de espalhados por controllers, e a normalização da página e do tamanho
tem um dono só e um teste só. Aqui ele vive no read model, e não no repositório do agregado,
porque a listagem não hidrata a entidade e não pertence aos casos de uso de escrita, como
registrado em "Leituras fora dos casos de uso". O dashboard mostra "página X de Y" e precisa
do total; `offset` com `total` é o que a tela pede e é barato no volume do enunciado. Cursor é
mais estável sob inserção concorrente e mais eficiente em páginas profundas, e é o caminho se
o volume crescer, mas não permite pular para uma página arbitrária, que é o que a interface
oferece. O limite de 100 impede que um único pedido leia a tabela inteira. `total` na mesma
transação garante que a página e a contagem sejam do mesmo instante.

## Atualização de status na interface

**Decisão:** o serviço de transações expõe `GET /transactions/:id/events`, um stream
Server-Sent Events por transação. Ao conectar, o cliente recebe o status atual; cada mudança
aplicada pelo consumer de status é repassada; quando o status deixa de ser pendente, o
servidor fecha o stream. O dashboard assina o stream só enquanto mostra uma transação
pendente. O fan-out é em memória, dentro da instância que aplicou o veredito.

**Alternativas consideradas:** o dashboard consultar `GET /transactions/:id` repetidamente
enquanto a transação estiver pendente; um canal WebSocket bidirecional (Socket.IO).

**Por quê:** medido localmente, o veredito fica visível entre 10 e 40 ms depois da criação,
então o que a interface precisa é ser avisada uma vez, no instante certo, e não repetir uma
consulta cuja resposta quase sempre já mudou antes da segunda tentativa. Consultar em
intervalo obriga a escolher um número que é grande demais para a maioria dos casos e pequeno
demais para os raros, e multiplica leituras que não trazem nada. SSE é unidirecional, roda
sobre HTTP simples, reconecta sozinho no navegador e o servidor fecha o stream no estado
terminal, então nenhuma conexão fica pendurada. WebSocket daria o mesmo com um canal de
volta que esta tela não usa: o cliente só ouve. O limite conhecido é o fan-out em memória:
com duas instâncias do serviço, o veredito aplicado em uma não chega ao stream aberto na
outra; a evolução é um pub/sub compartilhado (Redis) entre as instâncias, e a tela continua
correta mesmo sem ele porque a consulta direta sempre reflete o banco.

## Dashboard organizado por funcionalidade, com estado remoto no TanStack Query

**Decisão:** o dashboard Next.js separa `features/transactions` (chamadas à API, hooks e
componentes da funcionalidade) de `shared` (componentes de interface genéricos e utilitários
de formatação e acesso à API). O estado remoto fica no TanStack Query; as três telas tratam
carregando, erro (com "tentar de novo") e vazio como componentes explícitos, alcançáveis por
papel (`status`, `alert`). O formulário valida com `zod` e `react-hook-form` as mesmas regras
do serviço antes de sair do navegador. O detalhe assina o stream SSE só enquanto a transação
está pendente e o solta quando o veredito chega. O serviço de transações passa a aceitar
requisições de qualquer origem, porque não há autenticação neste recorte.

**Alternativas consideradas:** Server Components com busca no servidor e revalidação;
Redux Toolkit para o estado; organizar por tipo de arquivo (`components/`, `hooks/`, `api/`)
em vez de por funcionalidade.

**Por quê:** as três telas dependem de dados que mudam depois de renderizadas, então o
estado precisa viver no cliente com cache, invalidação e os três estados; o TanStack Query
entrega isso sem uma store global. Redux Toolkit é o que a vaga cita, e faz sentido quando há
estado de aplicação compartilhado entre telas; aqui todo estado é remoto e por tela, e uma
store seria camada sem função. Organizar por funcionalidade mantém tudo que muda junto no
mesmo lugar; `shared` só recebe o que já é usado por mais de uma tela. Os testes consultam a
interface pelo papel acessível, então rótulo, `status` e `alert` são parte do contrato da
tela, não detalhe visual.

## Volume alto de escritas e leituras concorrentes

**Decisão:** medir antes de mudar, e mudar na ordem em que a medição apontar. Os números que
eu acompanharia primeiro: latência do `POST` no p99, lag do grupo de consumers do antifraude
e do de status, quantas transações o varredor republica por passada (é o termômetro da
publicação falhando), tempo das consultas de listagem por filtro e tamanho do pool do Prisma
em uso. Com isso em mãos, a sequência que eu seguiria, cada passo local a uma fronteira que
já existe no código:

1. **Escrita.** O `POST` faz um insert e um produce, sem esperar o veredito; o primeiro
   limite é o pool do Prisma, dimensionado por réplica. O varredor vira um outbox com relay
   quando a taxa de falha de publicação ou o custo de varrer a tabela justificarem uma
   fila própria, sem tocar o caso de uso: a porta `EventPublisher` já isola quem publica.
2. **Processamento.** `transaction.created` já sai particionado por `transactionExternalId`;
   escalar o antifraude é aumentar partições e subir consumers até esse número, mantendo a
   ordem por transação. Réplicas do consumer de status são seguras porque a atualização só
   acontece a partir de `pending`.
3. **Leitura.** A listagem já usa os índices compostos dos filtros e vive em um read model
   separado. Os próximos passos, nessa ordem: paginação por cursor para páginas profundas,
   uma réplica de leitura do Postgres só para o `TransactionQueries` (a troca de conexão é
   local a essa classe), e omitir ou estimar o `total` quando a contagem passar a custar.
   O fan-out do SSE sai da memória do processo para um pub/sub (Redis ou um consumer por
   réplica) no dia em que houver mais de uma réplica do serviço de transações.

**Alternativas consideradas:** escalar horizontalmente de saída, sem medir; CQRS com banco de
leitura separado e cache de listagem desde já; sharding por conta.

**Por quê:** em produção financeira o gargalo raramente está onde a intuição aponta; no
gateway de pagamentos em que trabalho, o primeiro limite real foi o pool de conexões, não o
banco nem a fila. Cada passo acima é reversível e cabe em uma PR, porque as fronteiras já
estão no lugar: read model separado da escrita, publicação atrás de uma porta, consumers
idempotentes por construção. CQRS completo e sharding resolvem problemas que este volume
ainda não tem, e cobram consistência eventual e complexidade operacional desde o primeiro
dia.

## O recorte da vaga

**Decisão:** entregar o que o desafio pede, na stack que ele fixa, e registrar o que a
descrição da vaga cita e não entrou, com o momento em que entraria.

- **TypeORM**: o desafio fixa Prisma; a persistência está atrás de uma porta de repositório e
  de um read model, então a troca ficaria contida em `infrastructure/persistence`.
- **Redis**: não há cache nem sessão neste recorte. Entraria primeiro como pub/sub do SSE
  com mais de uma réplica, depois como cache das listagens mais consultadas.
- **Keycloak e OIDC**: não há autenticação; a API aceita qualquer origem. Antes de qualquer
  exposição, um guard na API validando o token e a sessão no dashboard.
- **Redux Toolkit**: o estado do dashboard é remoto e vive no TanStack Query. Redux entra
  quando houver estado de cliente compartilhado entre telas, o que ainda não existe.
- **Playwright**: a Testing Library por papel cobre as telas e seus estados; Playwright
  entraria para o fluxo completo com os dois serviços e o Kafka de pé.
- **Swagger**: o contrato HTTP vive em `packages/contracts` e é o mesmo tipo dos dois lados;
  OpenAPI quando houver um consumidor fora deste repositório.
- **LLM e evals**: fora do problema.

**Alternativas consideradas:** ampliar o escopo para cobrir a vaga; ignorar a vaga e entregar
só o enunciado sem dizer o que faltou.

**Por quê:** cada item é uma decisão de quando, não de se. Registrar isso mostra o que eu li
na vaga sem inflar a entrega com peças que o problema ainda não pede, e deixa claro onde
cada uma se encaixaria na arquitetura que existe.
