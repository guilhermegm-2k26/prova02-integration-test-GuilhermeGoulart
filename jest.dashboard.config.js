// Suíte separada que usa a conta real do dashboard (CONTACT_EMAIL / CONTACT_PASSWORD).
// Localmente os valores vêm do .env; no CI, dos secrets do repositório.
if (!process.env.CONTACT_EMAIL) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // sem .env: a suíte é pulada
  }
}

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/contact_list_dashboard.spec.ts'],
  verbose: true,
  testTimeout: 120000,
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './output',
        filename: 'contact-list-dashboard.html',
        pageTitle: 'Contact List - Dashboard',
        logoImgPath: './assets/jest-logo.png',
        expand: false,
        openReport: false
      }
    ]
  ]
};
