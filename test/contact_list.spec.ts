import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { faker } from '@faker-js/faker';
import { SimpleReporter } from '../simple-reporter';

// O router da Heroku corta qualquer requisição em 30 s (503). Cada requisição
// espera um pouco mais que isso, e cada teste comporta várias requisições.
const TIMEOUT_REQUISICAO = 35000;
jest.setTimeout(120000);

const userSchema = {
  type: 'object',
  properties: {
    _id: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string' }
  },
  required: ['_id', 'firstName', 'lastName', 'email']
};

const authSchema = {
  type: 'object',
  properties: {
    user: userSchema,
    token: { type: 'string' }
  },
  required: ['user', 'token']
};

const contactSchema = {
  type: 'object',
  properties: {
    _id: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    birthdate: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    street1: { type: 'string' },
    street2: { type: 'string' },
    city: { type: 'string' },
    stateProvince: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    owner: { type: 'string' }
  },
  required: ['_id', 'firstName', 'lastName', 'owner']
};

const novoUsuario = () => ({
  firstName: faker.person.firstName().slice(0, 20),
  lastName: faker.person.lastName().slice(0, 20),
  email: faker.internet.email({ provider: 'contactlist.test' }).toLowerCase(),
  password: faker.internet.password({ length: 12 })
});

const novoContato = () => ({
  firstName: faker.person.firstName().slice(0, 20),
  lastName: faker.person.lastName().slice(0, 20),
  birthdate: faker.date.birthdate().toISOString().slice(0, 10),
  email: faker.internet.email().toLowerCase(),
  phone: faker.string.numeric(10),
  street1: faker.location.street(),
  street2: 'Apto 101',
  city: faker.location.city(),
  stateProvince: 'SC',
  postalCode: faker.string.numeric(5),
  country: 'Brasil'
});

describe('Contact List API', () => {
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://thinking-tester-contact-list.herokuapp.com';
  const usuario = novoUsuario();

  let token = '';
  let userId = '';
  let contactId = '';

  p.request.setDefaultTimeout(TIMEOUT_REQUISICAO);

  beforeAll(async () => {
    p.reporter.add(rep);

    const res = await p
      .spec()
      .post(`${baseUrl}/users`)
      .withJson(usuario)
      .expectStatus(StatusCodes.CREATED)
      .expectJsonSchema(authSchema)
      .expectJsonLike({ user: { email: usuario.email } });

    token = res.body.token;
    userId = res.body.user._id;
  });

  afterAll(() => p.reporter.end());

  describe('Usuários - cadastro', () => {
    it('Rejeita cadastro sem campos obrigatórios', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson({})
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          _message: 'User validation failed',
          errors: {
            firstName: { kind: 'required' },
            lastName: { kind: 'required' },
            password: { kind: 'required' }
          }
        });
    });

    it('Rejeita cadastro com e-mail já utilizado', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson(usuario)
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJson({ message: 'Email address is already in use' });
    });

    it.each([
      [
        'e-mail em formato inválido',
        { email: 'email-invalido' },
        'email',
        'Email is invalid'
      ],
      [
        'senha com menos de 7 caracteres',
        { password: '123' },
        'password',
        'minimum allowed length (7)'
      ],
      [
        'senha com mais de 100 caracteres',
        { password: 'a'.repeat(101) },
        'password',
        'maximum allowed length (100)'
      ],
      [
        'nome com mais de 20 caracteres',
        { firstName: 'a'.repeat(21) },
        'firstName',
        'maximum allowed length (20)'
      ]
    ])('Rejeita cadastro com %s', async (_caso, campos, campo, mensagem) => {
      await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson({ ...novoUsuario(), ...campos })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { [campo]: { path: campo } } })
        .expectBodyContains(mensagem);
    });

    it('Aceita valores no limite: senha com 7 e nome com 20 caracteres', async () => {
      const limite = {
        ...novoUsuario(),
        firstName: 'a'.repeat(20),
        password: '1234567'
      };

      const tokenLimite = await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson(limite)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike({ user: { firstName: limite.firstName } })
        .returns('token');

      await p
        .spec()
        .delete(`${baseUrl}/users/me`)
        .withBearerToken(tokenLimite)
        .expectStatus(StatusCodes.OK);
    });

    it('Rejeita e-mail duplicado mesmo escrito em maiúsculas', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson({ ...novoUsuario(), email: usuario.email.toUpperCase() })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJson({ message: 'Email address is already in use' });
    });

    it('Rejeita nome preenchido só com espaços', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson({ ...novoUsuario(), firstName: '   ' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { firstName: { kind: 'required' } } });
    });

    it('Rejeita JSON malformado', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users`)
        .withHeaders('Content-Type', 'application/json')
        .withBody('{"firstName":')
        .expectStatus(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Usuários - login', () => {
    it('Realiza login com credenciais válidas', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: usuario.password })
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema(authSchema)
        .expectJsonLike({ user: { _id: userId } });
    });

    it('Rejeita login com senha errada', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: 'senhaErrada123' })
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });

    it('Rejeita login sem senha', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email })
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });

    it('Rejeita login de e-mail não cadastrado', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson(novoUsuario())
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });

    it('Login ignora maiúsculas e espaços em volta do e-mail', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({
          email: `  ${usuario.email.toUpperCase()}  `,
          password: usuario.password
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ user: { _id: userId } });
    });

    it('Bloqueia tentativa de injeção NoSQL no login', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: { $ne: null }, password: { $ne: null } })
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Usuários - perfil', () => {
    it('Retorna o perfil do usuário logado sem expor a senha', async () => {
      const res = await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema(userSchema)
        .expectJsonLike({ _id: userId, email: usuario.email });

      expect(res.body).not.toHaveProperty('password');
    });

    it('Bloqueia acesso ao perfil sem token', async () => {
      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });

    it('Bloqueia acesso ao perfil com token inválido', async () => {
      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken('token-invalido')
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });

    it('Atualiza o nome do usuário', async () => {
      usuario.firstName = faker.person.firstName().slice(0, 20);

      await p
        .spec()
        .patch(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .withJson({ firstName: usuario.firstName })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: userId, firstName: usuario.firstName });
    });

    it('Rejeita atualização com e-mail inválido', async () => {
      await p
        .spec()
        .patch(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .withJson({ email: 'email-invalido' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { email: { message: 'Email is invalid' } } });
    });

    it('Rejeita atualização para senha curta', async () => {
      await p
        .spec()
        .patch(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .withJson({ password: '123' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { password: { kind: 'minlength' } } });
    });

    it('Bloqueia token com assinatura adulterada', async () => {
      const adulterado = `${token.slice(0, -4)}${token.endsWith('AAAA') ? 'BBBB' : 'AAAA'}`;

      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken(adulterado)
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });
  });

  describe('Contatos', () => {
    const contato = novoContato();

    it('Cadastra um novo contato vinculado ao usuário', async () => {
      const res = await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson(contato)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonSchema(contactSchema)
        .expectJsonLike({ ...contato, owner: userId });

      contactId = res.body._id;
    });

    it('Rejeita contato sem nome e sobrenome', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ email: faker.internet.email() })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          _message: 'Contact validation failed',
          errors: {
            firstName: { kind: 'required' },
            lastName: { kind: 'required' }
          }
        });
    });

    it.each([
      ['e-mail inválido', 'email', 'abc', 'Email is invalid'],
      ['telefone inválido', 'phone', 'abc', 'Phone number is invalid'],
      [
        'data de nascimento fora do padrão AAAA-MM-DD',
        'birthdate',
        '10/05/1990',
        'Birthdate is invalid'
      ],
      ['CEP inválido', 'postalCode', 'abc!', 'Postal code is invalid'],
      [
        'data inexistente (30/02)',
        'birthdate',
        '2020-02-30',
        'Birthdate is invalid'
      ]
    ])('Rejeita contato com %s', async (_caso, campo, valor, mensagem) => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), [campo]: valor })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { [campo]: { message: mensagem } } });
    });

    it.each([
      ['firstName', 20],
      ['lastName', 20],
      ['phone', 15],
      ['street1', 40],
      ['city', 40],
      ['stateProvince', 20],
      ['postalCode', 10],
      ['country', 40]
    ])('Rejeita contato com %s acima de %i caracteres', async (campo, max) => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), [campo]: '1'.repeat(max + 1) })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { [campo]: { kind: 'maxlength' } } })
        .expectBodyContains(`maximum allowed length (${max})`);
    });

    it('Aceita acentos, apóstrofo e emoji nos nomes', async () => {
      const nomes = { firstName: 'José 🚀', lastName: "O'Brien-Ção" };

      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson(nomes)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike(nomes);
    });

    it('Ignora campos que não existem no modelo', async () => {
      const res = await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), campoExtra: 'não deve ser salvo' })
        .expectStatus(StatusCodes.CREATED);

      expect(res.body).not.toHaveProperty('campoExtra');
    });

    it('Rejeita corpo acima de 100 KB', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), street2: 'a'.repeat(110 * 1024) })
        .expectStatus(StatusCodes.REQUEST_TOO_LONG);
    });

    it('Bloqueia cadastro de contato sem token', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withJson(novoContato())
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });

    it('Lista os contatos do usuário', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema({ type: 'array', items: contactSchema })
        .expectJsonLike([{ _id: contactId }]);
    });

    it('Busca o contato pelo id', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema(contactSchema)
        .expectJsonLike({ _id: contactId, email: contato.email });
    });

    it('Retorna 400 para id de contato em formato inválido', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/id-invalido`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectBody('Invalid Contact ID');
    });

    it('Retorna 404 para contato inexistente', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/000000000000000000000000`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.NOT_FOUND);
    });

    it('PUT exige o objeto completo (rejeita atualização parcial)', async () => {
      await p
        .spec()
        .put(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson({ firstName: 'Parcial' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { lastName: { kind: 'required' } } });
    });

    it('PUT substitui todos os dados do contato', async () => {
      const substituto = novoContato();

      await p
        .spec()
        .put(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson(substituto)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ ...substituto, _id: contactId });
    });

    it('PATCH atualiza apenas o campo enviado', async () => {
      const cidade = faker.location.city();

      await p
        .spec()
        .patch(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson({ city: cidade })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: contactId, city: cidade, country: 'Brasil' });
    });

    it('Outro usuário não consegue acessar o contato', async () => {
      const outroToken = await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson(novoUsuario())
        .expectStatus(StatusCodes.CREATED)
        .returns('token');

      await p
        .spec()
        .get(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(outroToken)
        .expectStatus(StatusCodes.NOT_FOUND);

      await p
        .spec()
        .get(`${baseUrl}/contacts`)
        .withBearerToken(outroToken)
        .expectStatus(StatusCodes.OK)
        .expectJson([]);

      await p
        .spec()
        .patch(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(outroToken)
        .withJson({ firstName: 'Invasor' })
        .expectStatus(StatusCodes.NOT_FOUND);

      await p
        .spec()
        .delete(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(outroToken)
        .expectStatus(StatusCodes.NOT_FOUND);

      await p
        .spec()
        .get(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: contactId, country: 'Brasil' });

      await p
        .spec()
        .delete(`${baseUrl}/users/me`)
        .withBearerToken(outroToken)
        .expectStatus(StatusCodes.OK);
    });

    it('Exclui o contato', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectBody('Contact deleted');
    });

    it('Contato excluído não é mais encontrado', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.NOT_FOUND);
    });

    it('Excluir o mesmo contato de novo retorna 404', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.NOT_FOUND);
    });
  });

  describe('Desempenho e timeout', () => {
    it('Listagem de contatos responde em menos de 3 segundos', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectHeaderContains('content-type', 'application/json')
        .expectResponseTime(3000);
    });

    it('Aceita 10 cadastros de contato em paralelo', async () => {
      const respostas = await Promise.all(
        Array.from({ length: 10 }, () =>
          p
            .spec()
            .post(`${baseUrl}/contacts`)
            .withBearerToken(token)
            .withJson(novoContato())
            .expectStatus(StatusCodes.CREATED)
            .toss()
        )
      );

      const ids = respostas.map(res => res.body._id);
      expect(new Set(ids).size).toBe(10);
    });

    it('Rota sem tratamento não responde e é abortada pelo timeout do cliente', async () => {
      // PUT /users/me não existe na API e a requisição fica pendurada até
      // a Heroku devolver 503 em 30 s. O cliente desiste antes, em 5 s.
      const inicio = Date.now();
      p.settings.setLogLevel('SILENT'); // o Pactum loga o timeout como erro

      try {
        await expect(
          p
            .spec()
            .put(`${baseUrl}/users/me`)
            .withBearerToken(token)
            .withJson({})
            .withRequestTimeout(5000)
            .toss()
        ).rejects.toThrow('Timeout reached');
      } finally {
        p.settings.setLogLevel('INFO');
      }

      expect(Date.now() - inicio).toBeLessThan(10000);
    });
  });

  describe('Bugs encontrados (comportamento atual da API)', () => {
    it('[BUG] PATCH aceita o campo owner e transfere o contato para outro usuário', async () => {
      const outro = await p
        .spec()
        .post(`${baseUrl}/users`)
        .withJson(novoUsuario())
        .expectStatus(StatusCodes.CREATED);

      const idContato = await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson(novoContato())
        .expectStatus(StatusCodes.CREATED)
        .returns('_id');

      await p
        .spec()
        .patch(`${baseUrl}/contacts/${idContato}`)
        .withBearerToken(token)
        .withJson({ owner: outro.body.user._id })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ owner: outro.body.user._id });

      await p
        .spec()
        .get(`${baseUrl}/contacts/${idContato}`)
        .withBearerToken(outro.body.token)
        .expectStatus(StatusCodes.OK);

      await p
        .spec()
        .get(`${baseUrl}/contacts/${idContato}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.NOT_FOUND);

      await p
        .spec()
        .delete(`${baseUrl}/users/me`)
        .withBearerToken(outro.body.token)
        .expectStatus(StatusCodes.OK);
    });

    it('[BUG] Cliente escolhe o _id do contato e _id repetido expõe erro do MongoDB', async () => {
      const idEscolhido = faker.database.mongodbObjectId();

      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), _id: idEscolhido })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike({ _id: idEscolhido });

      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), _id: idEscolhido })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ name: 'MongoError', code: 11000 });
    });

    it('[BUG] Data de nascimento no futuro é aceita', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), birthdate: '2999-01-01' })
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike({ birthdate: '2999-01-01' });
    });

    it('[BUG] Token sem o prefixo "Bearer" é aceito', async () => {
      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withHeaders('Authorization', token)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: userId });
    });

    it('[BUG] Rota inexistente responde 200 com página HTML em vez de 404', async () => {
      await p
        .spec()
        .get(`${baseUrl}/rota-que-nao-existe`)
        .expectStatus(StatusCodes.OK)
        .expectHeaderContains('content-type', 'text/html')
        .expectBodyContains('<title>404</title>');
    });
  });

  describe('Sessão e exclusão de conta', () => {
    it('Novo login não invalida o token anterior', async () => {
      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: usuario.password })
        .expectStatus(StatusCodes.OK);

      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK);
    });

    it('Logout encerra todas as sessões do usuário, não só a atual', async () => {
      const segundoToken = await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: usuario.password })
        .expectStatus(StatusCodes.OK)
        .returns('token');

      await p
        .spec()
        .post(`${baseUrl}/users/logout`)
        .withBearerToken(segundoToken)
        .expectStatus(StatusCodes.OK);

      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken(segundoToken)
        .expectStatus(StatusCodes.UNAUTHORIZED);

      await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });

    it('Usuário excluído não consegue mais fazer login', async () => {
      const novoToken = await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: usuario.password })
        .expectStatus(StatusCodes.OK)
        .returns('token');

      await p
        .spec()
        .delete(`${baseUrl}/users/me`)
        .withBearerToken(novoToken)
        .expectStatus(StatusCodes.OK);

      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: usuario.password })
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });
  });
});
