import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function localAuth(): Plugin {
  return {
    name: 'withyou-local-auth',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const hostname = (request.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
        if (
          localHosts.has(hostname) &&
          localAddresses.has(request.socket.remoteAddress || '')
        ) {
          setHeader(request, 'x-withyou-user-id', 'local_withyou');
          setHeader(request, 'x-withyou-user-email', 'local@withyou.dev');
          setHeader(request, 'x-withyou-user-full-name', 'Local WithYou User');
        }
        next();
      });
    },
  };
}

function setHeader(request: IncomingMessage, name: string, value: string) {
  delete request.headers[name];
  for (let index = request.rawHeaders.length - 2; index >= 0; index -= 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) {
      request.rawHeaders.splice(index, 2);
    }
  }
  request.headers[name] = value;
  request.rawHeaders.push(name, value);
}
