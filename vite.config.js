// Vite-inställningar. Under `npm run dev` körs serverfunktionerna i api/
// direkt i Vite, med en lokal fil som databas (.data/). På Vercel körs de
// som riktiga serverfunktioner.

import { defineConfig } from 'vite';

function localApi() {
  return {
    name: 'bokgalaxen-lokalt-api',
    configureServer(server) {
      process.env.BOKGALAXEN_DEV = '1';
      server.middlewares.use(async (req, res, next) => {
        const match = req.url.match(/^\/api\/([a-z-]+)(\?.*)?$/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
          const handler = mod[req.method];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          server.ssrFixStacktrace(error);
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localApi()],
});
