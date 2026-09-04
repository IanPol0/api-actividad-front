import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const app = express();
const PORT = process.env.PORT || 3000;

// Tipo con los constructores/escuderías válidas presentes en los datos de F1
export type Constructor =
  | 'Alfa Romeo'
  | 'AlphaTauri'
  | 'Alpine F1 Team'
  | 'Arrows'
  | 'Aston Martin'
  | 'Audi'
  | 'BAR'
  | 'BMW Sauber'
  | 'Benetton'
  | 'Brawn'
  | 'Cadillac F1 Team'
  | 'Ferrari'
  | 'Force India'
  | 'HRT'
  | 'Haas F1 Team'
  | 'Honda'
  | 'Jaguar'
  | 'Jordan'
  | 'Lotus'
  | 'MF1'
  | 'Manor Marussia'
  | 'McLaren'
  | 'Mercedes'
  | 'Minardi'
  | 'Prost'
  | 'RB F1 Team'
  | 'Red Bull'
  | 'Renault'
  | 'Sauber'
  | 'Spyker'
  | 'Super Aguri'
  | 'Toro Rosso'
  | 'Toyota'
  | 'Virgin'
  | 'Williams';

// Interfaz que representa un registro de un piloto en una temporada de F1
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

export interface EquipoInfo {
  equipo: string;
  temporadas: number[];
  primeraTemporada: number;
  ultimaTemporada: number;
}

// Middlewares
app.use(cors());
app.use(express.json());

// Base de datos en memoria para actividades

let nextId = 4;

// Carpeta de datos persistente. Es el único lugar escribible junto con /tmp; el resto
// del filesystem del container es de solo lectura. DATA_DIR siempre la apunta: no se
// puede derivar de __dirname porque el código compilado corre desde dist/.
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../data');
const CSV_PATH = path.join(DATA_DIR, 'formula1.csv');

// Copia del CSV que viaja dentro de la imagen, al lado del código compilado (la genera
// scripts/bundle-data.mjs durante el build). La carpeta persistente puede estar vacía
// —el host no siempre siembra data/ desde el repo—, y sin este respaldo la app no
// tendría de dónde leer.
const CSV_EMPAQUETADO = path.join(__dirname, 'data', 'formula1.csv');

// Deja el CSV en la carpeta persistente si todavía no está, copiándolo del que viaja en
// la imagen. Es best-effort: si la carpeta no existe o no se puede escribir, la app
// igual funciona leyendo la copia empaquetada. La escritura es atómica (archivo temporal
// + rename) para que un arranque a medias nunca deje un CSV truncado.
function sembrarDatos(): void {
  if (fs.existsSync(CSV_PATH) || !fs.existsSync(CSV_EMPAQUETADO)) return;

  const temporal = path.join(DATA_DIR, `.formula1.csv.${process.pid}.tmp`);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.copyFileSync(CSV_EMPAQUETADO, temporal);
    fs.renameSync(temporal, CSV_PATH);
    console.log(`📦 CSV sembrado en ${CSV_PATH}`);
  } catch (error: any) {
    try {
      fs.unlinkSync(temporal);
    } catch {
      // el temporal puede no haberse llegado a crear
    }
    console.warn(`⚠️  No se pudo sembrar ${CSV_PATH} (${error.message}); se usa la copia empaquetada`);
  }
}

// Ruta del CSV a usar ahora mismo. Se resuelve en cada lectura, no una sola vez al
// arrancar, para que un archivo subido después desde el panel se tome sin redeployar.
function rutaCSV(): string | null {
  if (fs.existsSync(CSV_PATH)) return CSV_PATH;
  if (fs.existsSync(CSV_EMPAQUETADO)) return CSV_EMPAQUETADO;
  return null;
}

// Función para leer y parsear el archivo CSV de Fórmula 1
function getDriversFromCSV(): Driver[] {
  const ruta = rutaCSV();
  if (ruta === null) {
    throw new Error(
      `El archivo CSV no existe ni en ${CSV_PATH} ni en ${CSV_EMPAQUETADO}`
    );
  }

  const fileContent = fs.readFileSync(ruta, 'utf-8');
  const parsed = Papa.parse<any>(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });

  return parsed.data.map((row: any) => ({
    season: Number(row.season),
    driver_id: String(row.driver_id || '').trim(),
    driver_name: String(row.driver_name || '').trim(),
    nationality: String(row.nationality || '').trim(),
    constructor: String(row.constructor || '').trim() as Constructor,
    position: row.position !== null && row.position !== undefined && row.position !== '' ? Number(row.position) : null,
    points: Number(row.points || 0),
    wins: Number(row.wins || 0)
  }));
}

// Helper para normalizar búsquedas de texto (evita problemas de mayúsculas/minúsculas y acentos)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .trim();
}

// Publicada, la app se sirve bajo /<proyecto>/<app>/ y el proxy le saca ese prefijo
// antes de reenviar el pedido: la app siempre ve las rutas desde la raíz. Para que el
// índice de abajo muestre URLs que se puedan pegar tal cual en el navegador, se
// reconstruye el prefijo con la cabecera que manda el proxy (vacía en local).
function basePath(req: Request): string {
  return (req.header('X-Forwarded-Prefix') ?? '').replace(/\/$/, '');
}

// Health check: es lo que tic prueba antes de dar por buena una versión nueva, y lo que
// el container reporta como estado mientras corre. Devuelve 200 siempre — si fallara
// cuando falta el CSV, borrar ese archivo dejaría la app sin poder reiniciar. El estado
// de los datos va en el body, como diagnóstico.
app.get('/health', (req: Request, res: Response) => {
  const ruta = rutaCSV();
  res.status(200).json({
    status: 'ok',
    datos: ruta !== null,
    fuente: ruta === CSV_PATH ? 'persistente' : ruta === null ? 'ninguna' : 'empaquetada',
    dataDir: DATA_DIR
  });
});

// Ruta base con documentación interactiva de endpoints
app.get('/', (req: Request, res: Response) => {
  const base = basePath(req);
  res.json({
    mensaje: '🏎️ API de Fórmula 1 activa',
    estado: `GET ${base}/health`,
    rutasF1: {
      obtenerTodosLosPilotos: 'GET /api/drivers',
      obtenerPilotoPorIdONombre: 'GET /api/drivers/driver/:driver',
      obtenerTodosLosEquipos: 'GET /api/equipos',
      obtenerPilotosDeEquipoActual: 'GET /api/drivers/equipo/:equipo',
      obtenerHistoricoDeEquipo: 'GET /api/drivers/equipo/:equipo/historico'
    }
  });
});

// 1. GET /api/drivers -> Devuelve todos los registros del CSV (con soporte opcional de filtros por query params)
app.get('/api/drivers', (req: Request, res: Response) => {
  try {
    const drivers = getDriversFromCSV();
    const seasonQuery = req.query.season;
    const teamQuery = typeof req.query.constructor === 'string' ? req.query.constructor : typeof req.query.equipo === 'string' ? req.query.equipo : undefined;
    const natQuery = typeof req.query.nationality === 'string' ? req.query.nationality : undefined;

    let resultado = drivers;

    if (seasonQuery) {
      resultado = resultado.filter((d) => d.season === Number(seasonQuery));
    }

    if (teamQuery) {
      const teamNorm = normalizeText(teamQuery);
      resultado = resultado.filter((d) => normalizeText(d.constructor).includes(teamNorm));
    }

    if (natQuery) {
      const natNorm = normalizeText(natQuery);
      resultado = resultado.filter((d) => normalizeText(d.nationality).includes(natNorm));
    }

    res.status(200).json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al leer el archivo CSV', detalle: error.message });
  }
});

// 2. GET /api/drivers/driver/:driver -> Devuelve la información e historial de un piloto específico
app.get('/api/drivers/driver/:driver', (req: Request, res: Response) => {
  try {
    const drivers = getDriversFromCSV();
    const busqueda = normalizeText(req.params.driver);

    const registros = drivers.filter(
      (d) => normalizeText(d.driver_id) === busqueda || normalizeText(d.driver_name).includes(busqueda)
    );

    if (registros.length === 0) {
      return res.status(404).json({
        error: `No se encontró ningún piloto correspondiente a '${req.params.driver}'.`
      });
    }

    // Ordenar de la temporada más reciente a la más antigua
    registros.sort((a, b) => b.season - a.season);

    const infoPiloto = {
      driver_id: registros[0].driver_id,
      driver_name: registros[0].driver_name,
      nationality: registros[0].nationality,
      equipoActual: registros[0].constructor,
      totalPuntos: registros.reduce((sum, r) => sum + r.points, 0),
      totalVictorias: registros.reduce((sum, r) => sum + r.wins, 0),
      temporadasJugadas: registros.length,
      historico: registros
    };

    return res.status(200).json(infoPiloto);
  } catch (error: any) {
    return res.status(500).json({ error: 'Error al procesar el piloto', detalle: error.message });
  }
});

// 3. GET /api/drivers/equipo/:equipo/historico -> Devuelve todo el registro histórico de un equipo
app.get('/api/drivers/equipo/:equipo/historico', (req: Request, res: Response) => {
  try {
    const drivers = getDriversFromCSV();
    const equipoBuscado = normalizeText(req.params.equipo);

    const historico = drivers.filter((d) => normalizeText(d.constructor).includes(equipoBuscado));

    if (historico.length === 0) {
      return res.status(404).json({
        error: `No se encontraron registros para el equipo '${req.params.equipo}'.`
      });
    }

    // Ordenar por temporada desc y posición asc
    historico.sort((a, b) => b.season - a.season || (a.position || 99) - (b.position || 99));

    return res.status(200).json({
      equipo: historico[0].constructor,
      totalRegistros: historico.length,
      historico
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Error al obtener histórico del equipo', detalle: error.message });
  }
});

// 4. GET /api/drivers/equipo/:equipo -> Devuelve los pilotos del equipo en su temporada más reciente disponible
app.get('/api/drivers/equipo/:equipo', (req: Request, res: Response) => {
  try {
    const drivers = getDriversFromCSV();
    const equipoBuscado = normalizeText(req.params.equipo);

    const registrosEquipo = drivers.filter((d) => normalizeText(d.constructor).includes(equipoBuscado));

    if (registrosEquipo.length === 0) {
      return res.status(404).json({
        error: `No se encontró el equipo '${req.params.equipo}'.`
      });
    }

    // Determinar la última temporada registrada para ese equipo
    const ultimaTemporada = Math.max(...registrosEquipo.map((d) => d.season));
    const pilotosUltimaTemporada = registrosEquipo.filter((d) => d.season === ultimaTemporada);

    return res.status(200).json({
      equipo: pilotosUltimaTemporada[0].constructor,
      temporada: ultimaTemporada,
      pilotos: pilotosUltimaTemporada
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Error al obtener datos del equipo', detalle: error.message });
  }
});

// 5. GET /api/equipos -> Devuelve la lista de todos los equipos/escuderías únicos con sus temporadas activas
app.get(['/api/equipos', '/api/teams'], (req: Request, res: Response) => {
  try {
    const drivers = getDriversFromCSV();
    const equiposMap = new Map<string, Set<number>>();

    drivers.forEach((d) => {
      if (d.constructor) {
        if (!equiposMap.has(d.constructor)) {
          equiposMap.set(d.constructor, new Set<number>());
        }
        if (d.season) {
          equiposMap.get(d.constructor)!.add(Number(d.season));
        }
      }
    });

    const equipos: EquipoInfo[] = Array.from(equiposMap.entries())
      .map(([equipo, temporadasSet]) => {
        const temporadas = Array.from(temporadasSet).sort((a, b) => a - b);
        return {
          equipo,
          temporadas,
          primeraTemporada: temporadas[0],
          ultimaTemporada: temporadas[temporadas.length - 1]
        };
      })
      .sort((a, b) => a.equipo.localeCompare(b.equipo));

    return res.status(200).json(equipos);
  } catch (error: any) {
    return res.status(500).json({ error: 'Error al obtener los equipos', detalle: error.message });
  }
});

// Iniciar servidor
sembrarDatos();
app.listen(PORT, () => {
  console.log(`✅ Servidor F1 & Actividades corriendo en el puerto ${PORT} (datos en ${DATA_DIR})`);
});
