# Prova 02 — Testes de integração de API com Jest e PactumJS

[![Node.js CI](https://github.com/guilhermegm-2k26/prova02-integration-test-GuilhermeGoulart/actions/workflows/node.js.yml/badge.svg?branch=master)](https://github.com/guilhermegm-2k26/prova02-integration-test-GuilhermeGoulart/actions/workflows/node.js.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=guilhermegm-2k26_integration-tests-jest&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=guilhermegm-2k26_integration-tests-jest)

Testes automatizados de integração da **[Contact List API](https://documenter.getpostman.com/view/4012288/TzK2bEa8)**: uma API REST pública com JSON e autenticação por token, que tem cadastro de usuários e CRUD de contatos. Os testes cobrem **POST, GET, PUT, PATCH e DELETE**, com cenários de sucesso, campos faltando, formatos inválidos e regras de negócio.

> Documentação técnica completa da API e do plano de testes: [`docs/contact-list-api.md`](docs/contact-list-api.md)

## Sumário

- [Tecnologias](#tecnologias)
- [API testada](#api-testada)
- [Regras de negócio](#regras-de-negócio)
- [Validações de campos](#validações-de-campos)
- [Cenários de teste](#cenários-de-teste)
- [Estratégia de testes](#estratégia-de-testes)
- [Timeouts](#timeouts)
- [Bugs encontrados](#bugs-encontrados)
- [Como executar](#como-executar)
- [Relatórios](#relatórios)
- [Integração contínua](#integração-contínua)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Outras APIs do projeto](#outras-apis-do-projeto)

## Tecnologias

| Ferramenta | Versão | Para que serve |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 | Ambiente de execução |
| [TypeScript](https://www.typescriptlang.org/) | 5.5 | Linguagem dos testes |
| [Jest](https://jestjs.io/) + [ts-jest](https://kulshekhar.github.io/ts-jest/) | 30 | Executa os testes e organiza as suítes |
| [PactumJS](https://pactumjs.github.io/) | 3.9 | Faz as requisições HTTP e valida status, JSON, schema, headers e tempo de resposta |
| [Faker](https://fakerjs.dev/) | 9.9 | Gera dados aleatórios: nomes, e-mails, endereços |
| [http-status-codes](https://www.npmjs.com/package/http-status-codes) | 2.2 | Constantes legíveis (`StatusCodes.CREATED` em vez de `201`) |
| [jest-html-reporters](https://www.npmjs.com/package/jest-html-reporters) | 3.1 | Relatório HTML, com o request e o response de cada teste |
| ESLint + Prettier | — | Padrão e formatação do código |
| GitHub Actions | — | Roda os testes a cada push, pull request e uma vez por dia |
| SonarCloud | — | Análise estática de qualidade do código |

## API testada

| | |
|---|---|
| **Nome** | Contact List API (Thinking Tester) |
| **Base URL** | `https://thinking-tester-contact-list.herokuapp.com` |
| **Documentação oficial** | https://documenter.getpostman.com/view/4012288/TzK2bEa8 |
| **App web (dashboard)** | https://thinking-tester-contact-list.herokuapp.com/contactList |
| **Formato** | JSON (`Content-Type: application/json`) |
| **Autenticação** | Token JWT: `Authorization: Bearer <token>` |
| **Infraestrutura** | Node.js + Express + MongoDB, hospedada na Heroku |

### Endpoints

**Usuários**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/users` | — | Cadastra usuário e retorna `{ user, token }` |
| `POST` | `/users/login` | — | Faz login e retorna `{ user, token }` |
| `GET` | `/users/me` | ✔ | Retorna o perfil do usuário logado |
| `PATCH` | `/users/me` | ✔ | Atualiza campos do usuário |
| `POST` | `/users/logout` | ✔ | Encerra **todas** as sessões do usuário |
| `DELETE` | `/users/me` | ✔ | Exclui a conta |

**Contatos**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/contacts` | ✔ | Cadastra contato |
| `GET` | `/contacts` | ✔ | Lista os contatos do usuário logado |
| `GET` | `/contacts/:id` | ✔ | Busca um contato |
| `PUT` | `/contacts/:id` | ✔ | Substitui o contato inteiro |
| `PATCH` | `/contacts/:id` | ✔ | Atualiza só os campos enviados |
| `DELETE` | `/contacts/:id` | ✔ | Exclui o contato |

### Exemplos de JSON

<details>
<summary><strong>POST /users</strong>: cadastro com sucesso (201)</summary>

```json
// Request
{ "firstName": "Ana", "lastName": "Silva", "email": "ana@teste.com", "password": "senha1234" }

// Response 201
{
  "user": { "_id": "6abb19c7d80def00157da8f3", "firstName": "Ana", "lastName": "Silva", "email": "ana@teste.com", "__v": 1 },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
</details>

<details>
<summary><strong>POST /contacts</strong>: cadastro com sucesso (201)</summary>

```json
// Request
{
  "firstName": "João", "lastName": "Souza", "birthdate": "1990-05-10",
  "email": "joao@teste.com", "phone": "8005551234",
  "street1": "Rua A", "street2": "Apto 1", "city": "Florianópolis",
  "stateProvince": "SC", "postalCode": "88000", "country": "Brasil"
}

// Response 201: mesmo objeto, com "_id" e "owner" (id do usuário dono)
```
</details>

<details>
<summary><strong>Erro de validação</strong> (400)</summary>

A API usa o formato do Mongoose: um item em `errors` para cada campo inválido.

```json
{
  "errors": {
    "password": {
      "name": "ValidatorError",
      "message": "Path `password` is required.",
      "kind": "required",
      "path": "password"
    }
  },
  "_message": "User validation failed",
  "message": "User validation failed: password: Path `password` is required."
}
```
</details>

<details>
<summary><strong>Sem autenticação</strong> (401)</summary>

```json
{ "error": "Please authenticate." }
```
</details>

## Regras de negócio

| # | Regra | Resposta da API |
|---|---|---|
| RN01 | `firstName`, `lastName` e `password` são obrigatórios no cadastro de usuário | 400, `kind: required` |
| RN02 | O e-mail do usuário é único | 400, `Email address is already in use` |
| RN03 | O e-mail precisa ter formato válido (usuário e contato) | 400, `Email is invalid` |
| RN04 | A senha tem entre 7 e 100 caracteres | 400, `minlength` / `maxlength` |
| RN05 | Nome e sobrenome têm no máximo 20 caracteres | 400, `maxlength` |
| RN06 | Credenciais inválidas ou incompletas no login | 401 |
| RN07 | Rotas de perfil e de contatos exigem token válido | 401, `Please authenticate.` |
| RN08 | O perfil nunca expõe a senha | Campo `password` ausente |
| RN09 | `firstName` e `lastName` são obrigatórios no contato | 400, `kind: required` |
| RN10 | Telefone, data de nascimento e CEP têm o formato validado | 400, `... is invalid` |
| RN11 | Id de contato em formato inválido | 400, `Invalid Contact ID` |
| RN12 | Contato inexistente ou já excluído | 404 |
| RN13 | `PUT` exige o objeto completo; `PATCH` aceita atualização parcial | 400 / 200 |
| RN14 | Um usuário não vê nem acessa contatos de outro | 404 e lista vazia |
| RN15 | O logout encerra **todas** as sessões do usuário, não só a atual | 401 em todos os tokens |
| RN16 | Depois de excluir a conta, o login falha | 401 |
| RN17 | O e-mail não diferencia maiúsculas e ignora espaços nas pontas | 200 / 400 |
| RN18 | Nome preenchido só com espaços conta como vazio | 400, `kind: required` |
| RN19 | Campos fora do modelo são ignorados | Não aparecem na resposta |
| RN20 | Um novo login não invalida tokens anteriores | 200 com o token antigo |
| RN21 | O corpo da requisição tem limite de 100 KB | 413 |

## Validações de campos

Limites e formatos confirmados chamando a API (cada valor no limite foi aceito, e um caractere a mais foi rejeitado).

**Usuário**

| Campo | Obrigatório | Regra |
|---|---|---|
| `firstName` | Sim | Até 20 caracteres; só espaços conta como vazio |
| `lastName` | Sim | Até 20 caracteres |
| `email` | — | Formato de e-mail; único, sem diferenciar maiúsculas |
| `password` | Sim | De 7 a 100 caracteres |

**Contato**

| Campo | Obrigatório | Regra |
|---|---|---|
| `firstName` | Sim | Até 20 caracteres |
| `lastName` | Sim | Até 20 caracteres |
| `birthdate` | Não | `AAAA-MM-DD` e data real (`2020-02-30` é rejeitada) |
| `email` | Não | Formato de e-mail |
| `phone` | Não | Formato de telefone, até 15 caracteres |
| `street1` | Não | Até 40 caracteres |
| `city` | Não | Até 40 caracteres |
| `stateProvince` | Não | Até 20 caracteres |
| `postalCode` | Não | Formato de CEP, até 10 caracteres |
| `country` | Não | Até 40 caracteres |

## Cenários de teste

### Suíte principal: 20 cenários

Arquivo: [`test/contact_list.spec.ts`](test/contact_list.spec.ts). Comando: `npm run test:contact`.

Antes dos cenários, o `beforeAll` cadastra um usuário descartável (`POST /users`) e guarda o token.

| # | Método | Cenário | Esperado | Regra |
|---|---|---|---|---|
| 1 | POST | Cadastro de usuário com corpo vazio | 400 com erros de `firstName`, `lastName` e `password` | RN01 |
| 2 | POST | Cadastro com e-mail já utilizado | 400, `Email address is already in use` | RN02 |
| 3 | POST | Login com credenciais válidas | 200 com token (JSON Schema validado) | — |
| 4 | POST | Login com senha errada | 401 | RN06 |
| 5 | POST | Cadastro de contato completo | 201, `owner` igual ao id do usuário | — |
| 6 | POST | Contato sem nome e sobrenome | 400 | RN09 |
| 7 | POST | Contato com e-mail inválido | 400, `Email is invalid` | RN03 |
| 8 | POST | Contato sem token | 401, `Please authenticate.` | RN07 |
| 9 | GET | Perfil do usuário logado | 200, sem o campo `password` | RN08 |
| 10 | GET | Listagem de contatos | 200, array com o contato criado | — |
| 11 | GET | Busca do contato por id | 200 | — |
| 12 | GET | Contato inexistente | 404 | RN12 |
| 13 | GET | Outro usuário tenta acessar o contato | 404 | RN14 |
| 14 | PUT | Substituição completa do contato | 200 com todos os dados novos | RN13 |
| 15 | PUT | Atualização parcial | 400, `lastName` obrigatório | RN13 |
| 16 | PATCH | Atualização de um campo do contato | 200, só esse campo muda | RN13 |
| 17 | PATCH | Contato com telefone inválido | 400, `Phone number is invalid` | RN10 |
| 18 | PATCH | Nome do usuário | 200 com o nome novo | — |
| 19 | DELETE | Exclusão do contato | 200 `Contact deleted`; depois, o `GET` dá 404 | RN12 |
| 20 | DELETE | Exclusão da conta | 200; depois, o login dá 401 | RN16 |

Por tipo: **8 POST, 5 GET, 2 PUT, 3 PATCH, 2 DELETE**. São 9 cenários de sucesso e 11 de erro ou de regra de negócio.

### Suíte do dashboard: 16 cenários

Arquivo: [`test/contact_list_dashboard.spec.ts`](test/contact_list_dashboard.spec.ts). Comando: `npm run test:dashboard`.

Esta suíte usa uma **conta real**, então os contatos criados ficam visíveis no [dashboard](https://thinking-tester-contact-list.herokuapp.com/contactList).

- **Só cria e consulta.** Não usa `PUT`, `PATCH`, `DELETE` nem logout. O logout derrubaria também a sessão aberta no navegador (RN15).
- **Tem config e relatório próprios** ([`jest.dashboard.config.js`](jest.dashboard.config.js)) e fica fora do `npm test`.
- **Credenciais:** `CONTACT_EMAIL` e `CONTACT_PASSWORD`, no `.env`. Sem elas, os testes são pulados.
- **Cada execução adiciona 2 contatos** à conta, marcados com "Teste automatizado".

| Método | Cenários |
|---|---|
| POST (8) | Contato completo (201); contato só com campos obrigatórios (201); sem campos obrigatórios (400); e-mail, telefone, data ou CEP inválido (4 × 400); sem token (401) |
| GET (8) | Contato completo por id; contato mínimo por id (sem campos opcionais); listagem com os dois; tempo de resposta < 3 s e content-type JSON; id inválido (400); id inexistente (404); sem token (401); perfil sem senha |

## Estratégia de testes

- **Isolamento:** a suíte principal cria um usuário novo, com dados do Faker, a cada execução e o exclui no último cenário. Nenhuma credencial fica no código, e as execuções não interferem umas nas outras.
- **Ordem dos cenários:** os blocos seguem o ciclo de vida do recurso, POST → GET → PUT → PATCH → DELETE. O id do contato criado no POST é reaproveitado nos blocos seguintes.
- **O que cada teste valida:**
  - Status HTTP (`expectStatus`)
  - Conteúdo do JSON (`expectJson` / `expectJsonLike`)
  - Estrutura da resposta com JSON Schema (`expectJsonSchema`)
  - Mensagens de erro (`expectBodyContains`)
  - Headers e tempo de resposta (`expectHeaderContains` / `expectResponseTime`)
- **Testes negativos:** cada método tem cenários de erro (campo obrigatório ausente, formato inválido, sem token, recurso inexistente e acesso de outro usuário), conferindo o status e a mensagem retornada.
- **Rastreabilidade:** cada cenário aponta para a regra de negócio (RN) que valida.

## Timeouts

- A API roda na Heroku, que **corta qualquer requisição em 30 s** e devolve `503 Application Error`.
- As respostas normais levam de **140 a 200 ms**, com picos de ~700 ms na primeira chamada.

| Configuração | Valor | Motivo |
|---|---|---|
| Timeout por requisição (`p.request.setDefaultTimeout`) | 35 s | Fica acima dos 30 s da Heroku, então um travamento aparece como `503`, e não como erro do cliente |
| Timeout por teste (`jest.setTimeout` / `testTimeout`) | 120 s | Comporta vários requests no mesmo teste, sem o Jest abortar antes do Pactum |

## Bugs encontrados

Comportamentos inesperados encontrados ao explorar a API. Estão registrados para referência e não fazem parte dos 20 cenários.

| # | Bug | Como reproduzir | Risco |
|---|---|---|---|
| B01 | **O dono do contato pode ser trocado:** o `PATCH /contacts/:id` aceita o campo `owner` | `PATCH {"owner": "<id de outro usuário>"}`: o contato sai da sua conta e vai para a do outro | Alto: atribuição em massa |
| B02 | O cliente pode escolher o `_id` do contato | `POST /contacts` com `"_id"` no corpo devolve 201 com esse id | Médio |
| B03 | `_id` repetido expõe o erro interno do banco | O mesmo `_id` duas vezes devolve 400 com `MongoError` código 11000 | Médio: vazamento de informação |
| B04 | Data de nascimento no futuro é aceita | `"birthdate": "2999-01-01"` devolve 201 | Baixo |
| B05 | Token sem o prefixo `Bearer` é aceito | `Authorization: <token>` devolve 200 | Baixo |
| B06 | Método não suportado em rota da API trava a requisição | `PUT /users/me` fica 30 s sem resposta até o `503` | Médio: prende conexões |
| B07 | Rota inexistente responde `200` com uma página HTML de 404 | `GET /rota-que-nao-existe` | Baixo |

## Como executar

**Pré-requisitos:** Node.js 22 ou superior e npm.

```bash
git clone https://github.com/guilhermegm-2k26/prova02-integration-test-GuilhermeGoulart.git
cd prova02-integration-test-GuilhermeGoulart
npm install
```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run test:contact` | Roda só a suíte principal da Contact List (20 cenários) |
| `npm run test:dashboard` | Roda a suíte da conta real (16 cenários; precisa do `.env`) |
| `npm test` | Roda todas as suítes do `jest.config.js` (sem a do dashboard) |
| `npm run ci` | Limpa `output/`, formata, verifica a formatação, roda o lint e todos os testes |
| `npm run format` | Formata o código com o Prettier |
| `npm run eslint` | Roda o lint e gera `output/eslint.html` |

### Variáveis de ambiente (só para a suíte do dashboard)

Crie um arquivo `.env` na raiz. Ele já está no `.gitignore` e nunca é enviado ao GitHub.

```env
CONTACT_EMAIL=seu-email@exemplo.com
CONTACT_PASSWORD=sua-senha
```

## Relatórios

Depois de rodar os testes, a pasta `output/` contém:

| Arquivo | Conteúdo |
|---|---|
| `output/report.html` | Relatório da suíte principal, com o request e o response de cada teste |
| `output/contact-list-dashboard.html` | Relatório da suíte do dashboard |
| `output/eslint.html` | Resultado do lint (gerado pelo `npm run ci`) |

## Integração contínua

O workflow [`.github/workflows/node.js.yml`](.github/workflows/node.js.yml) roda:

- **Quando:** a cada push e pull request na `master`, e todo dia às 12h UTC.
- **Job `Run Integration Tests`:** instala as dependências e roda `npm test`.
- **Job `Run SonarCloud`:** análise estática do código. Precisa do secret `SONAR_TOKEN`, e a *Automatic Analysis* precisa estar desligada no SonarCloud.

| Secret | Uso |
|---|---|
| `SONAR_TOKEN` | Autenticação no SonarCloud |

## Estrutura do projeto

```
.
├── .github/workflows/node.js.yml    # Pipeline do GitHub Actions
├── docs/contact-list-api.md         # Documentação da API e do plano de testes
├── test/
│   ├── contact_list.spec.ts         # Suíte principal: 20 cenários
│   ├── contact_list_dashboard.spec.ts # Suíte da conta real: 16 cenários
│   └── ...                          # Suítes de outras APIs (projeto original)
├── jest.config.js                   # Config do Jest (npm test)
├── jest.dashboard.config.js         # Config da suíte do dashboard
├── simple-reporter.ts               # Envia request/response do Pactum ao relatório HTML
├── sonar-project.properties         # Configuração do SonarCloud
└── package.json
```

## Outras APIs do projeto

Este repositório é um fork de [ugioni/integration-tests-jest](https://github.com/ugioni/integration-tests-jest). As suítes abaixo vieram do projeto original e continuam rodando no `npm test`, mas não fazem parte da prova:

[ServeRest](https://serverest.dev/#/) · [Toolshop](https://api.practicesoftwaretesting.com/api/documentation) · [Petstore](https://petstore.swagger.io/#/) · [JSONPlaceholder](https://jsonplaceholder.typicode.com/) · [httpbin](http://httpbin.org/) · [Rick and Morty](https://rickandmortyapi.com/documentation/#rest) · [Deck of Cards](https://deckofcardsapi.com/) · D&D Combat API

---

**Autor:** Guilherme Goulart
