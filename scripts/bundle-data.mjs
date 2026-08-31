// Copia data/ dentro de dist/ como parte del build.
//
// El Dockerfile que genera tic para el recipe node-ts arma la imagen de runtime con
// package*.json y dist/ solamente: data/ NO viaja en la imagen. En producción los datos
// tienen que venir de la carpeta persistente (DATA_DIR), que tic siembra desde el repo
// en el primer deploy — pero eso no pasa en todas las versiones del host, y si la
// carpeta queda vacía la app no tiene de dónde leer y responde 500.
//
// Con esta copia dentro de dist/, el CSV siempre viaja con el código compilado y sirve
// de semilla: al arrancar, server.ts la usa para llenar DATA_DIR si está vacía, y como
// último recurso lee directamente de acá.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'data');
const destino = join(raiz, 'dist', 'data');

if (!existsSync(origen)) {
  console.error(`bundle-data: no existe ${origen}`);
  process.exit(1);
}

cpSync(origen, destino, { recursive: true });
console.log(`bundle-data: ${origen} -> ${destino}`);
