import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 8082);
const app = await buildApp();
await app.listen({ port, host: '0.0.0.0' });
