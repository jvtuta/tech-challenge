# Transações com antifraude assíncrono

Uma API de transações financeiras em NestJS que grava cada transação como pendente, publica
um evento no Kafka, recebe o veredito de um microsserviço antifraude e atualiza o status; um
dashboard em Next.js que lista, filtra, cria e acompanha a mudança de status sem recarregar a
tela. Monorepo pnpm com dois serviços, um dashboard e dois pacotes compartilhados.

As decisões de arquitetura, com as alternativas consideradas e a resposta sobre volume alto de
escritas e leituras, estão no [DECISIONS.md](./DECISIONS.md).

- [O que foi construído](#o-que-foi-construído)
- [Como rodar](#como-rodar)
- [Como testar](#como-testar)
- [Como usar a API](#como-usar-a-api)
- [Estrutura do repositório](#estrutura-do-repositório)
- [O que ficou de fora](#o-que-ficou-de-fora)

## O que foi construído

```mermaid
flowchart LR
  Web[Dashboard Next.js] -- HTTP e SSE --> Tx[transactions NestJS]
  Tx -- grava pendente --> DB[(Postgres)]
  Tx -- transaction.created --> K[(Kafka)]
  K -- transaction.created --> AF[anti-fraud NestJS]
  AF -- transaction.status.updated --> K
  K -- transaction.status.updated --> Tx
  Tx -- aprova ou rejeita --> DB
```

**`apps/transactions`**: `POST /transactions` valida o corpo, grava a transação como
`pending` e, depois do commit, publica `transaction.created` com a chave igual ao id externo.
Se o broker recusar, a resposta continua sendo `201` e um varredor republica o evento das
pendentes com mais de 10 segundos, a cada 5 segundos, em lotes de até 100 por passada. O
varredor roda em cada instância do serviço, sem lock: republicar o mesmo evento duas vezes é
inócuo, porque a regra é determinística e o status só muda a partir de `pending`.

O consumer de `transaction.status.updated` aplica o veredito por uma escrita condicionada ao
status ainda ser `pending`, no `where` do `UPDATE`: duas aplicações concorrentes produzem uma
transição, dois vereditos opostos deixam um resultado, e uma duplicata não muda nada nem
notifica de novo. A mensagem é abandonada na terceira entrega para não prender a partição
enquanto o banco estiver fora: a transação segue pendente e o varredor recupera.

`GET /transactions/:id` devolve uma transação, `GET /transactions` lista com filtros,
paginação e ordenação, e `GET /transactions/:id/events` é um stream Server-Sent Events que
assina o fan-out antes de ler o status atual, entrega o atual e cada mudança, e fecha no
estado final.

**`apps/anti-fraud`**: consome `transaction.created`, aplica a regra (valor acima de 1000
rejeita, 1000 exato aprova) por uma função pura e publica `transaction.status.updated`.
Eventos fora do contrato são descartados com log; falha de infraestrutura é reentregue e
abandonada na terceira entrega da mesma mensagem, pelo mesmo motivo. `GET /health` responde
pela conexão real com o Kafka.

**`apps/web`**: listagem paginada com filtros por status, tipo, período e ordenação, que
reconsulta a página enquanto houver transação pendente nela e para quando não houver;
detalhe
que assina o stream SSE enquanto a transação está pendente e mostra o veredito assim que
chega; formulário de criação validado com as mesmas regras do serviço, com um gerador de UUID
em cada campo de conta. Carregando, erro e vazio são componentes explícitos, alcançáveis por
papel acessível, e é por papel que os testes consultam a tela.

**`packages/contracts`**: tipos do contrato HTTP, nomes dos tópicos, envelope versionado dos
eventos e o schema `zod` que valida o que chega do Kafka. **`packages/messaging`**: porta de
publicação, interface fluente (`dispatch(publisher).event(t).keyedBy(k).with(d).publish()`),
adapter KafkaJS com falha rápida, publisher em memória para testes e a criação dos tópicos
no boot de cada serviço.

Medido na máquina local: o veredito fica visível entre 10 e 40 ms depois do `POST`; com o
broker fora do ar, o `POST` responde entre 0,3 e 0,7 s, dependendo de a conexão ser
recusada de imediato ou expirar no limite de 1 s do producer.

## Como rodar

Pré-requisitos: Node 22 (`.nvmrc`), pnpm 10 ou superior e Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
```

Isso sobe Postgres, Kafka e Kafka UI, instala as dependências, compila os dois pacotes
compartilhados (os serviços os resolvem por `dist`, então o `pnpm install` já os constrói),
gera o cliente Prisma e aplica as migrations, que também semeiam os tipos de transferência:
1 transferência, 2 pagamento, 3 saque. Os tópicos do Kafka são criados pelos serviços ao
subir.

Depois, um comando sobe os três:

```bash
pnpm dev
```

Ele compila os pacotes compartilhados e sobe API, antifraude e dashboard em paralelo, com o
nome do app na frente de cada linha de log; `Ctrl+C` derruba os três. Para reiniciar ou
acompanhar um serviço isolado, cada um sobe sozinho:

```bash
pnpm --filter @tech-challenge/transactions dev   # http://localhost:3001
pnpm --filter @tech-challenge/anti-fraud dev     # http://localhost:3002/health
pnpm --filter @tech-challenge/web dev            # http://localhost:3000
```

As portas vêm do `.env`; nenhum serviço tem host ou porta em código. O Kafka UI fica em
http://localhost:8080 para inspecionar os tópicos.

## Como testar

```bash
pnpm quality        # lint, typecheck, format:check, test e build, na ordem; é o que o CI roda
pnpm test           # só os testes; o total sai no resumo do Jest
```

Os testes de integração são **por serviço**, contra a infraestrutura real do
`docker compose`, lendo o mesmo `.env`: o de transações sobe o `AppModule` com o Postgres e
troca só o publisher; o de status e o do antifraude falam com o Kafka de verdade, cada um
produzindo as mensagens de que precisa. **Nenhuma suíte sobe os dois serviços juntos**, então
o ciclo completo (criar, antifraude decidir, status atualizar) é verificação manual, descrita
em "Como usar a API". Os testes unitários e os do dashboard não dependem de nada externo.

```bash
pnpm --filter @tech-challenge/transactions test:unit                        # sem infra
pnpm --filter @tech-challenge/transactions exec jest --selectProjects e2e   # com infra
pnpm --filter @tech-challenge/web test
pnpm --filter @tech-challenge/anti-fraud exec jest -t "1000"                # por nome
```

O que cada suíte cobre:

- **transactions**: entidade e regra da transição; criação com publicação após o commit e
  com o broker recusando; varredor de pendentes; veredito aplicado por escrita condicional,
  com vereditos concorrentes e opostos contra o Postgres real; veredito órfão; listagem com
  filtros, ordenação, paginação e página e total no mesmo snapshot; SSE com mudança dentro da
  janela de assinatura e os status HTTP do stream; filtro de erros de negócio, com o teto de
  reentregas; health.
- **anti-fraud**: regra na fronteira (999.99, 1000, 1000.01); consumer publicando o veredito
  com a chave certa; descarte de evento fora do contrato e teto de reentregas; health com o
  broker fora.
- **messaging** e **contracts**: interface fluente, envelope, validação, orçamento de
  reentregas e publisher em memória.
- **web**: três estados da listagem e a tabela; a listagem chegando ao estado final sem
  navegar e o período do filtro em três fusos; validação, gerador de UUID e envio do
  formulário; detalhe reagindo ao SSE, à mensagem fora do contrato, à queda de conexão e ao
  404; boundary de erro.

O CI (`.github/workflows/quality.yml`) sobe Postgres e Kafka de verdade e roda exatamente
`pnpm quality`.

## Como usar a API

```bash
# criar (nasce pendente; o veredito chega pelo Kafka em milissegundos)
curl -s -X POST http://localhost:3001/transactions \
  -H 'content-type: application/json' \
  -d '{"accountExternalIdDebit":"9b2f1c3e-5a4d-4e6f-8a7b-1c2d3e4f5a6b","accountExternalIdCredit":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","transferTypeId":1,"value":120}'

# consultar
curl -s http://localhost:3001/transactions/<transactionExternalId>

# listar: status, transferTypeId, from, to (ISO-8601), page, pageSize (máximo 100), sort (createdAt ou value), sortDir
curl -s 'http://localhost:3001/transactions?status=approved&pageSize=5&sort=value&sortDir=desc'

# acompanhar o status até o estado final
curl -N http://localhost:3001/transactions/<transactionExternalId>/events
```

Respostas de erro: `400` para corpo ou filtro fora do formato, `404` para id desconhecido,
`422` para regra de negócio (tipo de transferência inexistente), `503` quando uma
dependência está indisponível.

## Estrutura do repositório

```
apps/
  transactions/   API e consumer de status; domain, application e infrastructure por módulo,
                  shared para o que é transversal (unidade de trabalho, erros, config, Prisma)
  anti-fraud/     consumer da regra; mesma organização
  web/            dashboard; features/transactions e shared, App Router
packages/
  contracts/      tipos, tópicos, envelope e schema dos eventos
  messaging/      porta de publicação, interface fluente, adapter Kafka e publisher em memória
.github/          workflow de CI e template de PR
```

Tudo entrou por PRs pequenas para `develop`, uma responsabilidade por branch, com o
`DECISIONS.md` crescendo na mesma PR em que a decisão foi tomada.

## O que ficou de fora

Cada item abaixo tem o porquê e o momento em que entraria no `DECISIONS.md`.

- **Outbox transacional e fila de mensagens envenenadas**: o varredor de pendentes cobre a
  falha de publicação com menos partes, e o teto de reentregas devolve a mensagem travada ao
  mesmo varredor; o outbox entra quando o volume pedir recuperação em milissegundos, e uma
  fila própria quando houver o que fazer com o evento abandonado além do log.
- **Descoberta de transação nova na listagem**: a listagem reconsulta enquanto houver
  pendente na página visível, então uma pendente à vista chega ao estado final sozinha, mas
  uma lista vazia continua vazia e quem está no filtro de aprovadas não vê uma aprovação
  chegar. Um stream da listagem cobriria isso e exige fan-out fora da memória do processo
  assim que houver mais de uma réplica.
- **Autenticação e autorização**: a API aceita qualquer origem e não há sessão no
  dashboard.
- **OpenAPI, Playwright, histórico de status, cache**: não fazem parte do problema neste
  recorte; a entrada "O recorte da vaga" no `DECISIONS.md` diz quando cada um valeria.
- **Empacotamento para produção**: não há Dockerfile dos serviços nem deploy; o
  `docker compose` cobre só a infraestrutura local.
