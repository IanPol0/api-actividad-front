import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const app = express();
const PORT = process.env.PORT || 3001;

// Interfaz que representa un registro de un piloto en una temporada de F1
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

// Interfaz para el modelo de Actividad (mantenido para retrocompatibilidad)
export interface Actividad {
  id: number;
  titulo: string;
  completada: boolean;
  fechaCreacion: string;
}

export interface CrearActividadDTO {
  titulo?: string;
}

// Middlewares
app.use(cors());
app.use(express.json());

// Base de datos en memoria para actividades
let actividades: Actividad[] = [
  {
    id: 1,
    titulo: 'Estudiar conceptos de React y State',
    completada: true,
    fechaCreacion: new Date('2026-08-30T10:00:00Z').toISOString()
  },
  {
    id: 2,
    titulo: 'Practicar useEffect haciendo fetch a una API',
    completada: false,
    fechaCreacion: new Date('2026-08-31T08:00:00Z').toISOString()
  },
  {
    id: 3,
    titulo: 'Enviar un formulario con POST usando fetch',
    completada: false,
    fechaCreacion: new Date('2026-08-31T08:30:00Z').toISOString()
  }
];

let nextId = 4;

// Función para leer y parsear el archivo CSV de Fórmula 1
const CSV_PATH = path.join(__dirname, '../data/formula1.csv');

function getDriversFromCSV(): Driver[] {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`El archivo CSV no existe en la ruta: ${CSV_PATH}`);
  }

  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
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
    constructor: String(row.constructor || '').trim(),
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

// Ruta base con documentación interactiva de endpoints
app.get('/', (req: Request, res: Response) => {
  res.json({
    mensaje: '🏎️ API de Fórmula 1 y Actividades activa',
    rutasF1: {
      obtenerTodosLosPilotos: 'GET /api/drivers',
      obtenerPilotoPorIdONombre: 'GET /api/drivers/driver/:driver',
      obtenerPilotosDeEquipoActual: 'GET /api/drivers/equipo/:equipo',
      obtenerHistoricoDeEquipo: 'GET /api/drivers/equipo/:equipo/historico'
    },
    rutasActividades: {
      obtenerActividades: 'GET /api/actividades',
      crearActividad: 'POST /api/actividades'
    }
  });
});

// 1. GET /api/drivers -> Devuelve todos los registros del CSV (con soporte opcional de filtros por query params)
app.get('/api/drivers', (req: Request, res: Response) => {
  try {
    const drivers = getDriversFromCSV();
    const { season, constructor, nationality } = req.query;

    let resultado = drivers;

    if (season) {
      resultado = resultado.filter((d) => d.season === Number(season));
    }

    if (constructor) {
      const teamNorm = normalizeText(String(constructor));
      resultado = resultado.filter((d) => normalizeText(d.constructor).includes(teamNorm));
    }

    if (nationality) {
      const natNorm = normalizeText(String(nationality));
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

// Rutas de Actividades (Retrocompatibilidad)
app.get('/api/actividades', (req: Request, res: Response) => {
  res.status(200).json(actividades);
});

app.post('/api/actividades', (req: Request<object, object, CrearActividadDTO>, res: Response) => {
  const { titulo } = req.body;

  if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
    return res.status(400).json({
      error: "El campo 'titulo' es obligatorio y debe ser un texto válido."
    });
  }

  const nuevaActividad: Actividad = {
    id: nextId++,
    titulo: titulo.trim(),
    completada: false,
    fechaCreacion: new Date().toISOString()
  };

  actividades.push(nuevaActividad);

  return res.status(201).json(nuevaActividad);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor F1 & Actividades corriendo en http://localhost:${PORT}`);
});
