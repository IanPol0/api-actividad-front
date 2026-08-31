# 🚀 API Simple de Actividades (Express + TypeScript)

API REST ligera escrita en **TypeScript** y **Node.js**, diseñada para ser desplegada en la nube y consumida por aplicaciones frontend (React, Vue, JS Vanilla, etc.) como práctica de peticiones HTTP con `fetch` y `useEffect`.

---

## 🛠️ Instalación y Ejecución Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar servidor en modo desarrollo (con auto-reload usando `tsx`):
   ```bash
   npm run dev
   ```

3. Compilar TypeScript a JavaScript:
   ```bash
   npm run build
   ```

4. Iniciar servidor compilado en producción (o para plataformas de deploy):
   ```bash
   npm start
   ```

El servidor estará corriendo por defecto en `http://localhost:3001` (o en el puerto asignado por la variable de entorno `PORT`).

---

## 📡 Endpoints de la API

### 1. Obtener todas las actividades (`GET`)
- **Ruta**: `GET /api/actividades`
- **Descripción**: Retorna la lista completa de actividades en formato JSON.
- **Respuesta (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "titulo": "Estudiar conceptos de React y State",
      "completada": true,
      "fechaCreacion": "2026-08-30T10:00:00.000Z"
    },
    {
      "id": 2,
      "titulo": "Practicar useEffect haciendo fetch a una API",
      "completada": false,
      "fechaCreacion": "2026-08-31T08:00:00.000Z"
    }
  ]
  ```

---

### 2. Crear una nueva actividad (`POST`)
- **Ruta**: `POST /api/actividades`
- **Headers requeridos**: `Content-Type: application/json`
- **Body de la petición**:
  ```json
  {
    "titulo": "Mi nueva actividad"
  }
  ```
- **Respuesta de éxito (201 Created)**:
  ```json
  {
    "id": 4,
    "titulo": "Mi nueva actividad",
    "completada": false,
    "fechaCreacion": "2026-08-31T08:35:00.123Z"
  }
  ```
- **Respuesta de error (400 Bad Request)**:
  ```json
  {
    "error": "El campo 'titulo' es obligatorio y debe ser un texto válido."
  }
  ```

---

## 💻 Ejemplos de uso en React con TypeScript (`useEffect` y `fetch`)

### Interfaz de Actividad en el Frontend
```ts
export interface Actividad {
  id: number;
  titulo: string;
  completada: boolean;
  fechaCreacion: string;
}
```

### Ejemplo 1: `useEffect` para cargar datos al montar el componente (`GET`)

```tsx
import { useState, useEffect } from 'react';
import { Actividad } from './types';

const API_URL = 'http://localhost:3001/api/actividades'; // Cambiar a la URL desplegada en producción

function ListaActividades() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error('Error en la respuesta del servidor');
        return res.json() as Promise<Actividad[]>;
      })
      .then((data) => {
        setActividades(data);
        setCargando(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setCargando(false);
      });
  }, []); // Se ejecuta 1 sola vez al montar el componente

  if (cargando) return <p>Cargando actividades...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul>
      {actividades.map((act) => (
        <li key={act.id}>
          {act.titulo} {act.completada ? '✅' : '⏳'}
        </li>
      ))}
    </ul>
  );
}

export default ListaActividades;
```

---

### Ejemplo 2: Enviar un nuevo elemento (`POST`)

```tsx
import { useState, FormEvent } from 'react';
import { Actividad } from './types';

interface Props {
  onActividadCreada?: (nuevaActividad: Actividad) => void;
}

function FormularioActividad({ onActividadCreada }: Props) {
  const [titulo, setTitulo] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    setGuardando(true);
    try {
      const response = await fetch('http://localhost:3001/api/actividades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ titulo }),
      });

      if (!response.ok) throw new Error('No se pudo crear la actividad');

      const nuevaActividad: Actividad = await response.json();
      
      if (onActividadCreada) onActividadCreada(nuevaActividad);
      
      setTitulo(''); // Limpiar el input
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Escribe una nueva actividad..."
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <button type="submit" disabled={guardando}>
        {guardando ? 'Guardando...' : 'Agregar'}
      </button>
    </form>
  );
}

export default FormularioActividad;
```

---

## 🌐 Notas de Deploy
- Servidor configurado con **TypeScript (`tsconfig.json`)**.
- Script `npm run build` genera la salida compilada en la carpeta `dist/`.
- Permite variables de entorno (`process.env.PORT`) y tiene **CORS totalmente habilitado** (`Access-Control-Allow-Origin: *`).
