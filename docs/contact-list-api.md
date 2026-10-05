# Contact List API — Documentação e plano de testes

API REST pública feita para estudo de testes, com usuários, autenticação por token (JWT) e CRUD de contatos. Todas as requisições e respostas usam JSON.

- **Base URL:** `https://thinking-tester-contact-list.herokuapp.com`
- **Documentação oficial:** https://documenter.getpostman.com/view/4012288/TzK2bEa8
- **App web:** https://thinking-tester-contact-list.herokuapp.com
- **Testes:** [`test/contact_list.spec.ts`](../test/contact_list.spec.ts)

## Como rodar

```bash
npm install
npm run test:contact
```

O relatório HTML é gerado em `output/report.html`.

Os testes **não usam uma conta fixa**. A cada execução, criam um usuário com dados aleatórios (faker) e o excluem no final. Nenhuma credencial fica no repositório.

## Autenticação

O cadastro (`POST /users`) e o login (`POST /users/login`) devolvem um `token`. As rotas protegidas exigem esse token no header:

```
Authorization: Bearer <token>
```

Sem token, com token inválido ou com token de uma sessão encerrada por logout, a resposta é:

```json
// 401 Unauthorized
{ "error": "Please authenticate." }
```

## Endpoints

### Usuários

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/users` | não | Cadastra usuário e retorna token |
| POST | `/users/login` | não | Faz login e retorna token |
| GET | `/users/me` | sim | Retorna o perfil do usuário logado |
| PATCH | `/users/me` | sim | Atualiza campos do usuário |
| POST | `/users/logout` | sim | Invalida o token atual |
| DELETE | `/users/me` | sim | Exclui a conta |

**POST /users** (a mesma resposta vale para o login)

```json
// Request
{
  "firstName": "Ana",
  "lastName": "Silva",
  "email": "ana@teste.com",
  "password": "senha1234"
}

// 201 Created
{
  "user": {
    "_id": "6abb19c7d80def00157da8f3",
    "firstName": "Ana",
    "lastName": "Silva",
    "email": "ana@teste.com",
    "__v": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erro de validação** (padrão Mongoose, com um item em `errors` por campo inválido):

```json
// 400 Bad Request
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

### Contatos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/contacts` | sim | Cadastra contato |
| GET | `/contacts` | sim | Lista os contatos do usuário logado |
| GET | `/contacts/:id` | sim | Busca um contato |
| PUT | `/contacts/:id` | sim | Substitui o contato inteiro |
| PATCH | `/contacts/:id` | sim | Atualiza só os campos enviados |
| DELETE | `/contacts/:id` | sim | Exclui o contato |

**POST /contacts**

```json
// Request
{
  "firstName": "João",
  "lastName": "Souza",
  "birthdate": "1990-05-10",
  "email": "joao@teste.com",
  "phone": "8005551234",
  "street1": "Rua A",
  "street2": "Apto 1",
  "city": "Florianópolis",
  "stateProvince": "SC",
  "postalCode": "88000",
  "country": "Brasil"
}

// 201 Created: mesmo objeto, com "_id" e "owner" (id do usuário dono)
```

## Regras de negócio

| # | Regra | Resposta |
|---|---|---|
| RN01 | `firstName`, `lastName` e `password` são obrigatórios no cadastro de usuário | 400, `kind: required` |
| RN02 | O e-mail do usuário é único | 400, `Email address is already in use` |
| RN03 | O e-mail precisa ter formato válido (usuário e contato) | 400, `Email is invalid` |
| RN04 | A senha tem entre 7 e 100 caracteres | 400, `minlength` / `maxlength` |
| RN05 | Nome e sobrenome têm no máximo 20 caracteres | 400, `maxlength` |
| RN06 | Credenciais inválidas ou incompletas no login | 401 |
| RN07 | Rotas de perfil e de contatos exigem token válido | 401, `Please authenticate.` |
| RN08 | O perfil nunca expõe a senha | campo `password` ausente |
| RN09 | `firstName` e `lastName` são obrigatórios no contato | 400, `kind: required` |
| RN10 | Telefone, data de nascimento (`AAAA-MM-DD`) e CEP são validados | 400, `... is invalid` |
| RN11 | Id de contato em formato inválido | 400, `Invalid Contact ID` |
| RN12 | Contato inexistente | 404 |
| RN13 | `PUT` exige o objeto completo; `PATCH` aceita atualização parcial | 400 / 200 |
| RN14 | Um usuário não vê nem acessa contatos de outro | 404 e lista vazia |
| RN15 | O logout encerra **todas** as sessões do usuário, não só a atual | 401 em todos os tokens |
| RN16 | Depois de excluir a conta, o login falha | 401 |
| RN17 | O e-mail não diferencia maiúsculas e ignora espaços nas pontas (login e duplicidade) | 200 / 400 |
| RN18 | Nome preenchido só com espaços conta como vazio | 400, `kind: required` |
| RN19 | Limites do contato: nome e sobrenome ≤ 20, telefone ≤ 15, rua, cidade e país ≤ 40, estado ≤ 20, CEP ≤ 10 | 400, `maxlength` |
| RN20 | Campos fora do modelo são ignorados | não aparecem na resposta |
| RN21 | Um novo login não invalida tokens anteriores | 200 com o token antigo |
| RN22 | O corpo da requisição tem limite de 100 KB | 413 |

## Casos de teste

| Grupo | Caso | Esperado | Regra |
|---|---|---|---|
| Cadastro | Corpo vazio | 400 com erros de `firstName`, `lastName` e `password` | RN01 |
| Cadastro | E-mail já cadastrado | 400 | RN02 |
| Cadastro | E-mail inválido | 400 | RN03 |
| Cadastro | Senha com 3 caracteres | 400 | RN04 |
| Cadastro | Senha com 101 caracteres | 400 | RN04 |
| Cadastro | Nome com 21 caracteres | 400 | RN05 |
| Cadastro | Senha com 7 e nome com 20 caracteres (limite exato) | 201 | RN04, RN05 |
| Cadastro | E-mail duplicado em maiúsculas | 400 | RN02, RN17 |
| Cadastro | Nome só com espaços | 400 | RN18 |
| Cadastro | JSON malformado | 400 | — |
| Login | Credenciais válidas | 200 com token (JSON Schema validado) | — |
| Login | Senha errada | 401 | RN06 |
| Login | Sem senha | 401 | RN06 |
| Login | E-mail não cadastrado | 401 | RN06 |
| Login | E-mail em maiúsculas e com espaços | 200 | RN17 |
| Login | Injeção NoSQL (`{"$ne": null}`) | 401 | RN06 |
| Perfil | `GET /users/me` | 200, sem campo `password` | RN08 |
| Perfil | Sem token | 401 | RN07 |
| Perfil | Token inválido | 401 | RN07 |
| Perfil | `PATCH` do nome | 200 com o nome novo | — |
| Perfil | `PATCH` com e-mail inválido | 400 | RN03 |
| Perfil | `PATCH` com senha curta | 400 | RN04 |
| Perfil | Token com assinatura adulterada | 401 | RN07 |
| Contatos | Cadastro completo | 201, `owner` igual ao id do usuário | — |
| Contatos | Sem nome e sobrenome | 400 | RN09 |
| Contatos | E-mail inválido | 400 | RN03 |
| Contatos | Telefone inválido | 400 | RN10 |
| Contatos | Data `10/05/1990` | 400 | RN10 |
| Contatos | CEP inválido | 400 | RN10 |
| Contatos | Data inexistente `2020-02-30` | 400 | RN10 |
| Contatos | Cada campo 1 caractere acima do limite (8 casos) | 400, `maxlength` | RN19 |
| Contatos | Acentos, apóstrofo e emoji nos nomes | 201, salvos sem alteração | — |
| Contatos | Campo extra no corpo | 201, campo ignorado | RN20 |
| Contatos | Corpo de 110 KB | 413 | RN22 |
| Contatos | Sem token | 401 | RN07 |
| Contatos | Listagem | 200, array com o contato criado | — |
| Contatos | Busca por id | 200 | — |
| Contatos | Id inválido | 400 | RN11 |
| Contatos | Id inexistente | 404 | RN12 |
| Contatos | `PUT` parcial | 400 | RN13 |
| Contatos | `PUT` completo | 200 com todos os dados novos | RN13 |
| Contatos | `PATCH` de um campo | 200, só esse campo muda | RN13 |
| Contatos | Outro usuário tenta `GET`, `PATCH` e `DELETE` | 404, lista vazia, contato intacto | RN14 |
| Contatos | Exclusão | 200, `Contact deleted` | — |
| Contatos | Busca após exclusão | 404 | RN12 |
| Contatos | Excluir o mesmo contato de novo | 404 | RN12 |
| Desempenho | Listagem | 200 JSON em menos de 3 s | — |
| Desempenho | 10 cadastros em paralelo | 10 × 201, ids distintos | — |
| Timeout | Rota sem tratamento (`PUT /users/me`) | Cliente aborta em 5 s com `Timeout reached` | B06 |
| Bugs | Ver tabela abaixo (5 testes) | Comportamento atual | B01 a B05 |
| Sessão | Novo login | Token antigo continua válido | RN21 |
| Sessão | Logout com o 2º token | O 1º e o 2º token passam a dar 401 | RN15 |
| Sessão | Login após excluir a conta | 401 | RN16 |

**Total: 64 testes.** Os `401` de login e o `404` de contato inexistente voltam com o corpo vazio, então nesses casos os testes validam só o status.

## Timeouts

- A API roda na Heroku. O router dela **corta qualquer requisição em 30 s** e devolve `503 Application Error`.
- Medido nos testes: as respostas normais levam de 140 a 200 ms, com picos de ~700 ms na primeira chamada.
- Configuração adotada:
  - **Requisição** (`p.request.setDefaultTimeout`): 35 s. Fica acima dos 30 s da Heroku, então um travamento aparece como `503`, e não como erro do cliente.
  - **Teste** (`jest.setTimeout` / `testTimeout`): 120 s. Comporta vários requests por teste. Antes, o Jest (30 s) podia matar o teste antes do Pactum (60 s) desistir, e o erro ficava confuso.
  - **Teste de timeout:** chama uma rota que trava e confirma que o cliente desiste sozinho em 5 s.

## Bugs encontrados

Os testes marcados com `[BUG]` validam o **comportamento atual** da API. Se a API for corrigida, eles vão falhar, e isso avisa que o comportamento mudou.

| # | Bug | Como reproduzir | Risco |
|---|---|---|---|
| B01 | **O dono de um contato pode ser trocado.** O `PATCH /contacts/:id` aceita o campo `owner` | `PATCH {"owner": "<id de outro usuário>"}`: o contato some da conta e aparece na do outro | Alto: atribuição em massa (mass assignment) |
| B02 | **O cliente escolhe o `_id`** do contato | `POST /contacts` com `"_id"` no corpo devolve 201 com esse id | Médio |
| B03 | **`_id` repetido expõe erro interno.** Volta o `MongoError` (código 11000) direto para o cliente | Mandar o mesmo `_id` duas vezes | Médio: vazamento de informação |
| B04 | **Data de nascimento no futuro é aceita** | `"birthdate": "2999-01-01"` devolve 201 | Baixo |
| B05 | **Token sem o prefixo `Bearer` é aceito** | `Authorization: <token>` devolve 200 | Baixo |
| B06 | **Método não suportado em rota da API trava a requisição** | `PUT /users/me`, `POST /contacts/:id` ou `DELETE /contacts` ficam 30 s sem resposta até o `503` da Heroku | Médio: prende conexões |
| B07 | **Rota inexistente responde `200`** com uma página HTML de 404 | `GET /rota-que-nao-existe` | Baixo |

Também foi observado, mas não virou teste: o `PATCH /users/me` aceita `{"tokens": []}` e derruba as sessões do próprio usuário; e o header `x-powered-by: Express` fica exposto.

## Suíte da conta do dashboard

Arquivo separado: [`test/contact_list_dashboard.spec.ts`](../test/contact_list_dashboard.spec.ts). Ele usa uma **conta real**, então os contatos criados aparecem em https://thinking-tester-contact-list.herokuapp.com/contactList.

- **Só cria e consulta.** Não exclui contato nem conta, não edita dados e não faz logout. O logout derrubaria também a sua sessão aberta no navegador (RN15).
- **Tem config e relatório próprios:** [`jest.dashboard.config.js`](../jest.dashboard.config.js) gera `output/contact-list-dashboard.html`.
- **Fica fora do `npm test`,** porque o `jest.config.js` ignora esse arquivo. A suíte principal não é afetada.
- **Credenciais:** `CONTACT_EMAIL` e `CONTACT_PASSWORD`, no `.env` (local) ou nos secrets do repositório (CI). Sem elas, os testes são pulados.

```bash
npm run test:dashboard
```

| Grupo | Caso | Esperado |
|---|---|---|
| POST | Contato com todos os campos | 201; fica salvo na conta |
| POST | Contato só com nome e sobrenome | 201; fica salvo na conta |
| POST | Sem campos obrigatórios | 400 (nada é criado) |
| POST | E-mail, telefone, data ou CEP inválido (4 casos) | 400 (nada é criado) |
| POST | Sem token | 401 |
| GET | Contato completo por id | 200 com os mesmos dados enviados |
| GET | Contato mínimo por id | 200, sem campos opcionais |
| GET | Lista de contatos | 200, inclui os dois criados |
| GET | Id inválido | 400 |
| GET | Id inexistente | 404 |
| GET | Sem token | 401 |
| GET | Perfil da conta | 200, sem campo `password` |
| GET | Tempo de resposta e content-type | JSON em menos de 3 s |

**Total: 16 testes.**

Cada execução adiciona **2 contatos** à conta: um completo (`street2` = "Teste automatizado") e um mínimo (sobrenome "Teste automatizado").
