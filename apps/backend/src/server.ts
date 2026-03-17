import 'dotenv/config';
import { buildApp } from './app';
import { env } from './config/env';

(async () => {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Hotel PMS API running on port ${env.PORT} [${env.NODE_ENV}]`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
