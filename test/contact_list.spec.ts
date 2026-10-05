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

  describe('POST', () => {
    const contato = novoContato();

    it('Rejeita cadastro de usuário sem campos obrigatórios', async () => {
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

    it('Rejeita contato com e-mail inválido', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...novoContato(), email: 'email-invalido' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { email: { message: 'Email is invalid' } } });
    });

    it('Bloqueia cadastro de contato sem token', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withJson(novoContato())
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });
  });

  describe('GET', () => {
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
        .expectJsonLike({ _id: contactId, owner: userId });
    });

    it('Retorna 404 para contato inexistente', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/000000000000000000000000`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.NOT_FOUND);
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
        .delete(`${baseUrl}/users/me`)
        .withBearerToken(outroToken)
        .expectStatus(StatusCodes.OK);
    });
  });

  describe('PUT', () => {
    it('Substitui todos os dados do contato', async () => {
      const substituto = novoContato();

      await p
        .spec()
        .put(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson(substituto)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ ...substituto, _id: contactId });
    });

    it('Exige o objeto completo (rejeita atualização parcial)', async () => {
      await p
        .spec()
        .put(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson({ firstName: 'Parcial' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { lastName: { kind: 'required' } } });
    });
  });

  describe('PATCH', () => {
    it('Atualiza apenas o campo enviado do contato', async () => {
      const cidade = faker.location.city().slice(0, 40);

      await p
        .spec()
        .patch(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson({ city: cidade })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: contactId, city: cidade, country: 'Brasil' });
    });

    it('Rejeita atualização do contato com telefone inválido', async () => {
      await p
        .spec()
        .patch(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .withJson({ phone: 'abc' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({
          errors: { phone: { message: 'Phone number is invalid' } }
        });
    });

    it('Atualiza o nome do usuário', async () => {
      const nome = faker.person.firstName().slice(0, 20);

      await p
        .spec()
        .patch(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .withJson({ firstName: nome })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: userId, firstName: nome });
    });
  });

  describe('DELETE', () => {
    it('Exclui o contato e ele não é mais encontrado', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectBody('Contact deleted');

      await p
        .spec()
        .get(`${baseUrl}/contacts/${contactId}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.NOT_FOUND);
    });

    it('Exclui a conta e o login passa a falhar', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK);

      await p
        .spec()
        .post(`${baseUrl}/users/login`)
        .withJson({ email: usuario.email, password: usuario.password })
        .expectStatus(StatusCodes.UNAUTHORIZED);
    });
  });
});
