# 🏎️ API REST de Fórmula 1 (Express + TypeScript)

API REST ligera y robusta construida con **Node.js**, **Express**, **TypeScript** y **PapaParse**. Lee y procesa dinámicamente un archivo CSV con estadísticas históricas y actuales de Fórmula 1 (`data/formula1.csv`). 

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
   El servidor estará corriendo en: `http://localhost:3001`

3. **Compilar TypeScript a JavaScript**:
   ```bash
   npm run build
   ```

4. **Iniciar servidor en producción** (ejecuta el código compilado en `dist/`):
   ```bash
   npm start
   ```

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
- **Descripción**: Devuelve un JSON con el mensaje de estado y el índice de rutas disponibles.

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

#### 6. Obtener la lista de todos los equipos y sus temporadas activas
- **Ruta**: `GET /api/equipos` (o `GET /api/teams`)
- **Descripción**: Devuelve un listado ordenado alfabéticamente de todas las escuderías/constructores con las temporadas en las que estuvieron activos.
- **Ejemplo**: `GET /api/equipos`
- **Respuesta (200 OK)**:
  ```json
  [
    {
      "nombre": "Alfa Romeo",
      "equipo": "Alfa Romeo",
      "temporadas": [2019, 2020, 2021, 2022, 2023],
      "primeraTemporada": 2019,
      "ultimaTemporada": 2023
    },
    {
      "nombre": "Alpine F1 Team",
      "equipo": "Alpine F1 Team",
      "temporadas": [2021, 2022, 2023, 2024, 2025, 2026],
      "primeraTemporada": 2021,
      "ultimaTemporada": 2026
    }
  ]
  ```

---

## 💻 Ejemplos de Integración en React + TypeScript

### 1. Cargar Pilotos de un Equipo al montar el componente (`useEffect` + `fetch`)

```tsx
import { useState, useEffect } from 'react';

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
    fetch(`http://localhost:3001/api/drivers/equipo/${equipo}`)
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
    fetch(`http://localhost:3001/api/drivers/driver/${driverId}`)
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
├── dist/                    # Código compilado (generado con npm run build)
├── package.json             # Dependencias y scripts
├── tsconfig.json            # Configuración de TypeScript
└── README.md                # Documentación del proyecto
```
