import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { faker } from '@faker-js/faker';
import { SimpleReporter } from '../simple-reporter';

// Usa a conta real do dashboard: só cria e consulta, nunca exclui nada.
// Rodar com: npm run test:dashboard (credenciais no .env ou nos secrets do CI)
const email = process.env.CONTACT_EMAIL;
const password = process.env.CONTACT_PASSWORD;
const describeComConta = email && password ? describe : describe.skip;

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

const contatoCompleto = () => ({
  firstName: faker.person.firstName().slice(0, 20),
  lastName: faker.person.lastName().slice(0, 20),
  birthdate: faker.date.birthdate().toISOString().slice(0, 10),
  email: faker.internet.email().toLowerCase(),
  phone: faker.string.numeric(10),
  street1: faker.location.street(),
  street2: 'Teste automatizado',
  city: faker.location.city(),
  stateProvince: 'SC',
  postalCode: faker.string.numeric(5),
  country: 'Brasil'
});

describeComConta('Contact List API - conta do dashboard', () => {
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://thinking-tester-contact-list.herokuapp.com';
  const completo = contatoCompleto();
  const minimo = {
    firstName: faker.person.firstName().slice(0, 20),
    lastName: 'Teste automatizado'
  };

  let token = '';
  let userId = '';
  let idCompleto = '';
  let idMinimo = '';

  // O router da Heroku corta qualquer requisição em 30 s (503).
  p.request.setDefaultTimeout(35000);

  beforeAll(async () => {
    p.reporter.add(rep);

    const res = await p
      .spec()
      .post(`${baseUrl}/users/login`)
      .withJson({ email, password })
      .expectStatus(StatusCodes.OK);

    token = res.body.token;
    userId = res.body.user._id;
  });

  afterAll(() => p.reporter.end());

  describe('POST /contacts', () => {
    it('Cadastra contato com todos os campos', async () => {
      const res = await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson(completo)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonSchema(contactSchema)
        .expectJsonLike({ ...completo, owner: userId });

      idCompleto = res.body._id;
    });

    it('Cadastra contato só com os campos obrigatórios', async () => {
      const res = await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson(minimo)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonSchema(contactSchema)
        .expectJsonLike({ ...minimo, owner: userId });

      idMinimo = res.body._id;
    });

    it('Rejeita contato sem campos obrigatórios', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ city: 'Florianópolis' })
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
      ['CEP inválido', 'postalCode', 'abc!', 'Postal code is invalid']
    ])('Rejeita contato com %s', async (_caso, campo, valor, mensagem) => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .withJson({ ...contatoCompleto(), [campo]: valor })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonLike({ errors: { [campo]: { message: mensagem } } });
    });

    it('Rejeita contato sem token', async () => {
      await p
        .spec()
        .post(`${baseUrl}/contacts`)
        .withJson(contatoCompleto())
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });
  });

  describe('GET - consultas', () => {
    it('Consulta o contato completo pelo id', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/${idCompleto}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema(contactSchema)
        .expectJsonLike({ ...completo, _id: idCompleto, owner: userId });
    });

    it('Consulta o contato mínimo pelo id, sem campos opcionais', async () => {
      const res = await p
        .spec()
        .get(`${baseUrl}/contacts/${idMinimo}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ ...minimo, _id: idMinimo });

      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('phone');
    });

    it('Lista de contatos inclui os dois contatos criados', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema({ type: 'array', items: contactSchema })
        .expectJsonLike([{ _id: idCompleto }, { _id: idMinimo }]);
    });

    it('Consultas respondem JSON em menos de 3 segundos', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/${idCompleto}`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectHeaderContains('content-type', 'application/json')
        .expectResponseTime(3000);

      await p
        .spec()
        .get(`${baseUrl}/contacts`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectHeaderContains('content-type', 'application/json')
        .expectResponseTime(3000);
    });

    it('Retorna 400 para id em formato inválido', async () => {
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

    it('Bloqueia consulta sem token', async () => {
      await p
        .spec()
        .get(`${baseUrl}/contacts/${idCompleto}`)
        .expectStatus(StatusCodes.UNAUTHORIZED)
        .expectJson({ error: 'Please authenticate.' });
    });

    it('Consulta o perfil da conta sem expor a senha', async () => {
      const res = await p
        .spec()
        .get(`${baseUrl}/users/me`)
        .withBearerToken(token)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({ _id: userId, email });

      expect(res.body).not.toHaveProperty('password');
    });
  });
});
