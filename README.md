# HydraGen Console

Interfaz web desarrollada en Angular para la configuración, generación y despliegue de benchmarks utilizando HydraGen.

## Requisitos

### Frontend

- Node.js 18+ (recomendado)
- npm

### Backend

- Python 3.10+
- pip
- virtualenv (opcional pero recomendado)

---

# Ejecución del Frontend

Instalar dependencias:

```bash
npm install
```

Iniciar la aplicación Angular en modo desarrollo:

```bash
npm start
```

La interfaz estará disponible en:

```text
http://localhost:4200
```

---

# Ejecución del Backend (FastAPI)

Entrar al directorio del backend:

```bash
cd pipeline
```

Crear un entorno virtual:

```bash
python -m venv venv
```

Activar el entorno virtual:

### Linux / macOS

```bash
source venv/bin/activate
```

### Windows (PowerShell)

```powershell
.\venv\Scripts\Activate.ps1
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

Ejecutar el backend:

```bash
./run.sh
```

El servicio FastAPI quedará disponible en:

```text
http://localhost:8000
```

---

# Ejecución completa

Para utilizar la aplicación correctamente deben estar ejecutándose:

1. Frontend Angular

```bash
npm start
```

2. Backend FastAPI

```bash
cd pipeline
./run.sh
```

Una vez ambos servicios estén activos, acceder a:

```text
http://localhost:4200
```

---

