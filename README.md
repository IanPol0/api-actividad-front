# 🏎️ API REST de Fórmula 1 y Actividades (Express + TypeScript)

API REST ligera y robusta construida con **Node.js**, **Express**, **TypeScript** y **PapaParse**. Lee y procesa dinámicamente un archivo CSV con estadísticas históricas y actuales de Fórmula 1 (`data/formula1.csv`), además de incluir un servicio de gestión de actividades en memoria. 

Está diseñada para ser consumida por aplicaciones frontend (React, Vue, JS Vanilla, etc.) como práctica de peticiones HTTP con `fetch`, `useEffect` y manejo de estado en TypeScript.

---

## 🚀 Tecnologías Utilizadas

- **Node.js & Express**: Servidor web y enrutamiento HTTP.
- **TypeScript**: Tipado estático estricto (Interfaces, Union Types para escuderías).
- **PapaParse**: Parseo rápido y dinámico de archivos CSV.
- **CORS**: Habilitado para permitir peticiones desde cualquier origen frontend.
- **TSX**: Ejecución y recarga en tiempo real para desarrollo (`npm run dev`).

---

## 🛠️ Instalación y Ejecución Local

1. **Clonar e instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar servidor en modo desarrollo** (con recarga automática):
   ```bash
   npm run dev
   ```
   El servidor estará corriendo en: `http://localhost:3000`

3. **Compilar TypeScript a JavaScript**:
   ```bash
   npm run build
   ```

4. **Iniciar servidor en producción** (ejecuta el código compilado en `dist/`):
   ```bash
   npm start
   ```

---

## 🚀 Despliegue en tic

La API está adaptada al recipe **`node-ts`** de [tic](https://hosting.ort.edu.ar), el
hosting del colegio. tic **genera su propio `Dockerfile` en cada publicación** y pisa
cualquiera que haya en el repo, así que acá no hay ninguno: no hace falta, y tenerlo
confunde sobre quién manda.

### Publicar

tic no es donde trabajás: es un *remoto de deploy*. Se agrega una vez y se le pushea.

```bash
git remote add tic ssh://<tu-dni>@belgrano.ort.arg@<host>:<puerto>/<proyecto>/<app>.git
git push tic hosteado:main
```

La URL exacta la da el panel de tu app, con un botón para copiarla — usá esa y no la
armes a mano. Dos detalles que parecen errores de tipeo y no lo son: tu usuario lleva el
`@belgrano.ort.arg` pegado (el DNI solo no resuelve), y por eso hay **dos `@`** en la
línea. El puerto tampoco es el 22 habitual.

> ⚠️ **`git push` que termina bien NO significa que el deploy funcionó.** git devuelve
> éxito apenas tic recibe los objetos, antes de construir nada. La única fuente de verdad
> son las líneas con prefijo `remote:` que aparecen en la terminal. Si el build falla, la
> versión anterior **sigue en línea**: tic solo publica lo que pasa su health check.

### El contrato que cumple esta app

| Requisito de `node-ts` | Cómo lo cumple |
|---|---|
| `package.json` + `package-lock.json` en la raíz | ✅ presentes y sincronizados (tic corre `npm ci`, un lockfile desfasado rompe el build) |
| `npm run build` que compile TypeScript | ✅ `tsc` |
| `tsconfig.json` con `rootDir: src` y `outDir` = `build_dir` | ✅ `src/` → `dist/` |
| Entrypoint compilado en `dist/server.js` | ✅ tic ejecuta `node dist/server.js` |
| Escuchar en `process.env.PORT` | ✅ `process.env.PORT || 3000` (el 3000 es solo el fallback local) |
| Responder `200` en `GET /health` | ✅ agregado — **sin esto el publish se cancela siempre** |
| Dependencias de runtime fuera de `devDependencies` | ✅ `express`, `cors` y `papaparse` están en `dependencies`; el runtime instala con `--omit=dev` |

Además, tic inyecta `PORT`, `NODE_ENV` y `DATA_DIR`, y **no se pueden pisar** desde el
panel de variables de entorno.

### Rutas: la app se sirve bajo un subpath

Publicada, la API vive en `https://<host>/<proyecto>/<app>/`. El proxy **le saca ese
prefijo** antes de reenviar el pedido, así que del lado del servidor las rutas no
cambian: la app sigue viendo `/api/drivers`, `/health`, etc. Lo que sí cambia es la URL
que usa el cliente, que tiene que incluir el prefijo (ver los ejemplos de React más
abajo).

El índice de `GET /` se arma con la cabecera `X-Forwarded-Prefix` que manda el proxy, así
que las rutas que lista ya vienen con el prefijo correcto y se pueden pegar tal cual.

Límites del proxy a tener en cuenta: cuerpo máximo de **10 MB** por request y **60 s** de
timeout de lectura.

### Los datos: `data/` es persistente, y el CSV del repo es solo la semilla

En producción `data/` es un volumen que **sobrevive a cada publicación**; el resto del
filesystem es de **solo lectura** (escribir en otro lado falla con `EROFS`). El código lee
el CSV desde `process.env.DATA_DIR`, que tic siempre apunta a esa carpeta:

```ts
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../data');
const CSV_PATH = path.join(DATA_DIR, 'formula1.csv');
```

El Dockerfile que genera tic arma la imagen de runtime con `package*.json` y `dist/`
solamente: **`data/` no viaja en la imagen**. Los datos tienen que salir de la carpeta
persistente, que en principio tic siembra desde el `data/` del repo en el primer deploy.

> ⚠️ **Esa siembra no ocurre en todas las versiones del host.** Si la carpeta persistente
> queda vacía, la app no tiene de dónde leer y responde `500` en todas las rutas de
> pilotos. Pasó en el primer deploy real, con `DATA_DIR=/data` vacío.

Por eso el build copia `data/` dentro de `dist/` (`scripts/bundle-data.mjs`): así el CSV
**siempre viaja con el código compilado**. Al arrancar, la app resuelve los datos en este
orden:

1. `$DATA_DIR/formula1.csv` — la carpeta persistente, si el archivo está ahí.
2. Si no está, intenta **sembrarla** copiando el CSV empaquetado (escritura atómica:
   archivo temporal + `rename`).
3. Si la carpeta no existe o es de solo lectura, lee **directamente la copia
   empaquetada** y sigue funcionando, solo que sin persistencia.

La ruta se resuelve en **cada lectura**, no una sola vez al arrancar, así que un archivo
subido después desde la tarjeta **Archivos** del panel se toma sin redeployar.

> ⚠️ **Pushear un CSV modificado no cambia el archivo ya desplegado**: una vez que la
> carpeta persistente tiene el suyo, manda ése. Para reemplazarlo, la tarjeta **Archivos**
> del panel.

`GET /health` **siempre devuelve 200** — si fallara, borrar el CSV desde el panel dejaría
la app sin poder reiniciar — e informa de dónde está leyendo:

```json
{ "status": "ok", "datos": true, "fuente": "persistente", "dataDir": "/app/data" }
```

`fuente` vale `persistente`, `empaquetada` o `ninguna`. Si ves `empaquetada`, la carpeta
persistente está vacía o no es escribible: la app anda, pero lo que subas al panel no se
va a estar usando hasta que esa carpeta funcione.

Las actividades de `POST /api/actividades` siguen siendo **en memoria**: se pierden en
cada reinicio, redeploy o cambio de variable de entorno. Es a propósito — el endpoint
existe para practicar `fetch`, no para guardar datos.

### Desde el panel

Con tu cuenta del colegio (usuario = DNI, solo desde la red del colegio) podés
republicar, volver a un commit anterior, reiniciar el container, ver logs y tráfico,
gestionar las variables de entorno y subir o bajar archivos de `data/`. Guardar una
variable de entorno **redespliega la app**, no es gratis.

---

## 📊 Estructura de Datos (CSV y TypeScript)

### Archivo de datos: `data/formula1.csv`
Columnas del CSV:
`season,driver_id,driver_name,nationality,constructor,position,points,wins`

### Tipos e Interfaces en TypeScript (`src/server.ts`)

```ts
// Tipo Union con las 35 escuderías válidas de la F1 en el conjunto de datos
export type Constructor =
  | 'Alfa Romeo' | 'AlphaTauri' | 'Alpine F1 Team' | 'Arrows' | 'Aston Martin'
  | 'Audi' | 'BAR' | 'BMW Sauber' | 'Benetton' | 'Brawn' | 'Cadillac F1 Team'
  | 'Ferrari' | 'Force India' | 'HRT' | 'Haas F1 Team' | 'Honda' | 'Jaguar'
  | 'Jordan' | 'Lotus' | 'MF1' | 'Manor Marussia' | 'McLaren' | 'Mercedes'
  | 'Minardi' | 'Prost' | 'RB F1 Team' | 'Red Bull' | 'Renault' | 'Sauber'
  | 'Spyker' | 'Super Aguri' | 'Toro Rosso' | 'Toyota' | 'Virgin' | 'Williams';

// Interfaz para un registro de piloto en una temporada
export interface Driver {
  season: number;
  driver_id: string;
  driver_name: string;
  nationality: string;
  constructor: Constructor;
  position: number | null;
  points: number;
  wins: number;
}
```

---

## 📡 Documentación de Endpoints

### 🏁 Endpoints de Fórmula 1

#### 1. Ruta Base y Estado de la API
- **Ruta**: `GET /`
- **Descripción**: Devuelve un JSON con el mensaje de estado y el índice de rutas
  disponibles. Publicada en tic, las rutas del índice vienen con el subpath de la app ya
  incluido.

---

#### 1b. Health Check
- **Ruta**: `GET /health`
- **Descripción**: Estado del servicio. Es el endpoint que usa tic para decidir si una
  versión nueva se publica, y el que el container reporta mientras corre. **Siempre
  responde `200`**; el campo `datos` indica si el CSV está disponible.
- **Respuesta (200 OK)**:
  ```json
  { "status": "ok", "datos": true }
  ```

---

#### 2. Obtener todos los registros / Filtrar pilotos
- **Ruta**: `GET /api/drivers`
- **Descripción**: Devuelve la lista completa de registros de pilotos presentes en el CSV.
- **Parámetros Opcionales (Query Params)**:
  - `season`: Filtrar por año de la temporada (ej: `/api/drivers?season=2026`).
  - `constructor` / `equipo`: Filtrar por nombre de la escudería (ej: `/api/drivers?constructor=Ferrari`).
  - `nationality`: Filtrar por nacionalidad del piloto (ej: `/api/drivers?nationality=Argentine`).
- **Respuesta (200 OK)**:
  ```json
  [
    {
      "season": 2026,
      "driver_id": "colapinto",
      "driver_name": "Franco Colapinto",
      "nationality": "Argentine",
      "constructor": "Alpine F1 Team",
      "position": 16,
      "points": 1,
      "wins": 0
    }
  ]
  ```

---

#### 3. Obtener información e historial de un piloto específico
- **Ruta**: `GET /api/drivers/driver/:driver`
- **Descripción**: Busca a un piloto por su `driver_id` (ej: `colapinto`, `michael_schumacher`) o por nombre. Devuelve sus estadísticas acumuladas (puntos, victorias, temporadas) y el historial de todas sus temporadas.
- **Ejemplo**: `GET /api/drivers/driver/colapinto`
- **Respuesta (200 OK)**:
  ```json
  {
    "driver_id": "colapinto",
    "driver_name": "Franco Colapinto",
    "nationality": "Argentine",
    "equipoActual": "Alpine F1 Team",
    "totalPuntos": 1,
    "totalVictorias": 0,
    "temporadasJugadas": 1,
    "historico": [
      {
        "season": 2026,
        "driver_id": "colapinto",
        "driver_name": "Franco Colapinto",
        "nationality": "Argentine",
        "constructor": "Alpine F1 Team",
        "position": 16,
        "points": 1,
        "wins": 0
      }
    ]
  }
  ```

---

#### 4. Obtener los pilotos de un equipo en su temporada más reciente
- **Ruta**: `GET /api/drivers/equipo/:equipo`
- **Descripción**: Busca la escudería especificada (insensible a mayúsculas/minúsculas y acentos) y devuelve sus pilotos de la temporada más reciente registrada.
- **Ejemplo**: `GET /api/drivers/equipo/Ferrari`
- **Respuesta (200 OK)**:
  ```json
  {
    "equipo": "Ferrari",
    "temporada": 2026,
    "pilotos": [
      {
        "season": 2026,
        "driver_id": "leclerc",
        "driver_name": "Charles Leclerc",
        "nationality": "Monegasque",
        "constructor": "Ferrari",
        "position": 3,
        "points": 49,
        "wins": 0
      },
      {
        "season": 2026,
        "driver_id": "hamilton",
        "driver_name": "Lewis Hamilton",
        "nationality": "British",
        "constructor": "Ferrari",
        "position": 4,
        "points": 41,
        "wins": 0
      }
    ]
  }
  ```

---

#### 5. Obtener todo el historial de un equipo
- **Ruta**: `GET /api/drivers/equipo/:equipo/historico`
- **Descripción**: Retorna todas las filas históricas en las que participó el equipo en cualquier temporada.
- **Ejemplo**: `GET /api/drivers/equipo/Ferrari/historico`
- **Respuesta (200 OK)**:
  ```json
  {
    "equipo": "Ferrari",
    "totalRegistros": 31,
    "historico": [ ... ]
  }
  ```

---

### 📝 Endpoints de Actividades (Gestión en memoria)

#### 1. Obtener todas las actividades (`GET`)
- **Ruta**: `GET /api/actividades`
- **Respuesta (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "titulo": "Estudiar conceptos de React y State",
      "completada": true,
      "fechaCreacion": "2026-08-30T10:00:00.000Z"
    }
  ]
  ```

#### 2. Crear una nueva actividad (`POST`)
- **Ruta**: `POST /api/actividades`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "titulo": "Practicar fetch con la API de F1"
  }
  ```
- **Respuesta (201 Created)**:
  ```json
  {
    "id": 4,
    "titulo": "Practicar fetch con la API de F1",
    "completada": false,
    "fechaCreacion": "2026-08-31T12:00:00.000Z"
  }
  ```

---

## 💻 Ejemplos de Integración en React + TypeScript

> **Ojo con la URL base.** Los ejemplos usan una constante `API_BASE` en vez de tener la
> dirección escrita en cada `fetch`. En local es `http://localhost:3000`; publicada en
> tic, la API vive bajo su subpath, así que es
> `https://<host>/<proyecto>/<app>`. Es el único ajuste que tiene que hacer el front:
>
> ```ts
> // src/api.ts
> export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';
> ```


### 1. Cargar Pilotos de un Equipo al montar el componente (`useEffect` + `fetch`)

```tsx
import { useState, useEffect } from 'react';
import { API_BASE } from './api';

export interface Driver {
  season: number;
  driver_id: string;
  driver_name: string;
  nationality: string;
  constructor: string;
  position: number | null;
  points: number;
  wins: number;
}

interface EquipoResponse {
  equipo: string;
  temporada: number;
  pilotos: Driver[];
}

export function EscuderiaF1({ equipo = 'Ferrari' }: { equipo?: string }) {
  const [data, setData] = useState<EquipoResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/drivers/equipo/${equipo}`)
      .then((res) => {
        if (!res.ok) throw new Error('Equipo no encontrado');
        return res.json() as Promise<EquipoResponse>;
      })
      .then((data) => {
        setData(data);
        setCargando(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setCargando(false);
      });
  }, [equipo]);

  if (cargando) return <p>🏎️ Cargando datos del equipo...</p>;
  if (error) return <p>❌ Error: {error}</p>;
  if (!data) return null;

  return (
    <div>
      <h2>🏆 {data.equipo} - Temporada {data.temporada}</h2>
      <ul>
        {data.pilotos.map((piloto) => (
          <li key={piloto.driver_id}>
            <strong>{piloto.driver_name}</strong> ({piloto.nationality}) - {piloto.points} pts - {piloto.wins} victorias
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### 2. Buscar Info de un Piloto Específico

```tsx
import { useState, useEffect } from 'react';
import { API_BASE } from './api';

interface PilotoInfo {
  driver_id: string;
  driver_name: string;
  nationality: string;
  equipoActual: string;
  totalPuntos: number;
  totalVictorias: number;
  temporadasJugadas: number;
}

export function DetallePiloto({ driverId }: { driverId: string }) {
  const [piloto, setPiloto] = useState<PilotoInfo | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/drivers/driver/${driverId}`)
      .then((res) => res.json())
      .then((data) => setPiloto(data))
      .catch((err) => console.error(err));
  }, [driverId]);

  if (!piloto) return <p>Cargando información del piloto...</p>;

  return (
    <div className="card">
      <h3>👤 {piloto.driver_name}</h3>
      <p>🚩 Nacionalidad: {piloto.nationality}</p>
      <p>🏎️ Equipo: {piloto.equipoActual}</p>
      <p>🏆 Puntos Totales: {piloto.totalPuntos}</p>
      <p>🥇 Victorias Totales: {piloto.totalVictorias}</p>
    </div>
  );
}
```

---

## 📁 Estructura del Proyecto

```
api-actividad-front/
├── data/
│   └── formula1.csv         # Archivo CSV con datos de la F1 (2000-2026)
├── src/
│   └── server.ts            # Servidor principal Express en TypeScript
├── scripts/
│   └── bundle-data.mjs      # Copia data/ dentro de dist/ durante el build
├── dist/                    # Código compilado (generado con npm run build, no versionado)
├── package.json             # Dependencias y scripts
├── package-lock.json        # Lockfile — obligatorio para el build en tic
├── tsconfig.json            # Configuración de TypeScript
└── README.md                # Documentación del proyecto
```

No hay `Dockerfile` ni configuración de CI, y es intencional: tic genera el suyo en cada
publicación a partir del recipe `node-ts` y pisa cualquiera que esté en el repo.
