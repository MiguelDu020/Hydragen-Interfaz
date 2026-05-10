import asyncio
import subprocess
import threading
import uuid
import json
import os
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="HydraGen Backend", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global job store ──────────────────────────────────────────────────────────
# Structure: job_id -> { status, logs, current_step, step_name, error, created_at }
jobs: dict = {}
metrics_process: Optional[subprocess.Popen] = None

TOTAL_STEPS = 4


# ── Request / Response Models ─────────────────────────────────────────────────
class ExecuteRequest(BaseModel):
    config: dict
    hydragen_path: str = "/home/user/hydragen"
    sudo_password: Optional[str] = ""
    ssh_password: Optional[str] = ""


class ExecuteResponse(BaseModel):
    job_id: str
    status: str
    message: str


class StatusResponse(BaseModel):
    job_id: str
    status: str
    current_step: int
    total_steps: int
    step_name: str
    error: Optional[str] = None


# ── Pipeline helpers ──────────────────────────────────────────────────────────
def _make_env() -> dict:
    """Return an environment dict with Go bin dir in PATH."""
    env = os.environ.copy()
    go_bin = "/usr/local/go/bin"
    current_path = env.get("PATH", "")
    if go_bin not in current_path:
        env["PATH"] = f"{go_bin}:{current_path}"
    return env


def _append_log(job_id: str, line: str, step: int, level: str = "INFO") -> None:
    if job_id not in jobs:
        return
    jobs[job_id]["logs"].append({
        "line": line,
        "step": step,
        "level": level
    })


def run_command(
    cmd: str,
    cwd: str,
    job_id: str,
    step_num: int,
    step_name: str,
    env: Optional[dict] = None
) -> int:
    """Execute a shell command and stream its output line-by-line into the job log."""
    jobs[job_id]["current_step"] = step_num
    jobs[job_id]["step_name"] = step_name

    _append_log(job_id, f"$ {cmd}", step_num, "INFO")

    process = subprocess.Popen(
        cmd,
        shell=True,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env or _make_env()
    )

    for raw_line in iter(process.stdout.readline, ""):  # type: ignore[union-attr]
        line = raw_line.rstrip()
        if line:
            lower = line.lower()
            if any(kw in lower for kw in ("error", "failed", "fatal", "panic")):
                level = "ERROR"
            elif any(kw in lower for kw in ("warn", "warning")):
                level = "WARN"
            else:
                level = "INFO"
            _append_log(job_id, line, step_num, level)

    process.wait()
    return process.returncode


# ── Pipeline execution (runs in a background thread) ─────────────────────────
def execute_pipeline(
    job_id: str,
    config: dict,
    hydragen_path: str,
    sudo_password: str,
    ssh_password: str
) -> None:
    """Full HydraGen pipeline — runs in a dedicated thread."""
    # Carpeta donde están los scripts (backend/)
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Rutas dentro del repositorio de HydraGen
    input_dir = os.path.join(hydragen_path, "generator/input")
    input_file = os.path.join(input_dir, "description.json")

    try:
        # ── STEP 1: Save JSON ────────────────────────────────────────────────
        jobs[job_id]["current_step"] = 1
        jobs[job_id]["step_name"] = "Guardando archivo de configuración..."

        os.makedirs(input_dir, exist_ok=True)
        with open(input_file, "w") as f:
            json.dump(config, f, indent=2)

        _append_log(job_id, f"✓ JSON guardado en {input_file}", 1, "INFO")
        _append_log(job_id, f"  Servicios: {len(config.get('services', []))}", 1, "INFO")

        run_path = os.path.join(hydragen_path, "generator")
        # ── STEP 2: generator.sh ─────────────────────────────────────────────
        generator_script = os.path.join(backend_dir, "generator.sh")
        rc = run_command(
            #f"bash {generator_script} preset input/description.json",
            f"echo '{sudo_password}' | sudo -S bash generator.sh preset input/description.json",
            run_path, job_id, 2,
            "Generando imagen Docker y manifiestos Kubernetes..."
        )
        if rc != 0:
            raise RuntimeError(f"generator.sh falló con código de salida {rc}")

        _append_log(job_id, "✓ Imagen Docker y manifiestos generados", 2, "INFO")

        ##sudo chown sistemas:sistemas hydragen-emulator.tar
        # ── STEP 2.5: chage the owner of the image ─────────────────────
        run_path = os.path.join(hydragen_path, "generator/generated")
        rc = run_command(
            f"echo '{sudo_password}' | sudo chown sistemas:sistemas hydragen-emulator.tar",
            run_path,
            job_id,
            3,
            "Cambiando propietario del TAR...",
        )

        # ── STEP 3: containerd-push-image-to-clusters.sh ─────────────────────
        #push_script = os.path.join(backend_dir, "containerd-push-image-to-clusters.sh")
        push_script = "containerd-push-image-to-clusters.sh"
        run_path = os.path.join(hydragen_path, "community")
        flags: list[str] = []
        if ssh_password:
            flags.append(f'-p "{ssh_password}"')
        if sudo_password:
            flags.append(f'-s "{sudo_password}"')
        else:
            flags.append("-n")  # no sudo password

        push_cmd = f'bash {push_script} {" ".join(flags)}'

        rc = run_command(
            push_cmd,
            run_path, job_id, 3,
            "Distribuyendo imagen Docker a los nodos del clúster..."
        )
        if rc != 0:
            raise RuntimeError(f"Push de imagen falló con código de salida {rc}")

        _append_log(job_id, "✓ Imagen distribuida a todos los nodos", 3, "INFO")

        # ── STEP 4: deploy.sh ────────────────────────────────────────────────
        #deploy_script = os.path.join(backend_dir, "deploy.sh")
        deploy_script = "deploy.sh"
        run_path = os.path.join(hydragen_path, "generator")
        rc = run_command(
            f"bash {deploy_script} input/description.json",
            run_path, job_id, 4,
            "Desplegando microservicios en Kubernetes..."
        )
        if rc != 0:
            raise RuntimeError(f"deploy.sh falló con código de salida {rc}")

        _append_log(job_id, "✓ Benchmark desplegado correctamente en Kubernetes", 4, "INFO")

        # ── Done ─────────────────────────────────────────────────────────────
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["step_name"] = "Pipeline completado exitosamente"
        jobs[job_id]["current_step"] = TOTAL_STEPS

    except Exception as exc:
        cur_step = jobs[job_id].get("current_step", 0)
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(exc)
        _append_log(job_id, f"✗ Error: {exc}", cur_step, "ERROR")


# ── Background cleanup (removes jobs older than 1 hour) ──────────────────────
def _cleanup_old_jobs() -> None:
    while True:
        time.sleep(300)  # check every 5 minutes
        cutoff = datetime.utcnow() - timedelta(hours=1)
        stale = [
            jid for jid, job in list(jobs.items())
            if job.get("created_at", datetime.utcnow()) < cutoff
            and job.get("status") in ("completed", "failed")
        ]
        for jid in stale:
            jobs.pop(jid, None)


threading.Thread(target=_cleanup_old_jobs, daemon=True).start()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/execute", response_model=ExecuteResponse)
def execute(req: ExecuteRequest):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "running",
        "logs": [],
        "current_step": 0,
        "step_name": "Iniciando pipeline...",
        "error": None,
        "created_at": datetime.utcnow()
    }

    t = threading.Thread(
        target=execute_pipeline,
        args=(job_id, req.config, req.hydragen_path, req.sudo_password or "", req.ssh_password or ""),
        daemon=True
    )
    t.start()

    return ExecuteResponse(
        job_id=job_id,
        status="started",
        message="Pipeline iniciado correctamente"
    )


@app.get("/status/{job_id}", response_model=StatusResponse)
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' no encontrado")

    return StatusResponse(
        job_id=job_id,
        status=job["status"],
        current_step=job["current_step"],
        total_steps=TOTAL_STEPS,
        step_name=job["step_name"],
        error=job.get("error")
    )


@app.get("/logs/{job_id}")
async def stream_logs(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' no encontrado")

    async def log_stream():
        idx = 0
        while True:
            job = jobs.get(job_id)
            if not job:
                break

            # Flush all pending log lines
            while idx < len(job["logs"]):
                payload = json.dumps(job["logs"][idx])
                yield f"data: {payload}\n\n"
                idx += 1

            # Check termination
            if job["status"] in ("completed", "failed"):
                end_payload = json.dumps({"line": "__END__", "step": -1, "level": "INFO"})
                yield f"data: {end_payload}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        log_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )
@app.get("/metrics/start")
def start_metrics():
    global metrics_process
    
    # Check if already running
    if metrics_process and metrics_process.poll() is None:
        return {"status": "already_running", "url": "http://localhost:3000"}
    
    try:
        cmd = "kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring"
        metrics_process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        # Give it a second to start
        time.sleep(1.5)
        
        if metrics_process.poll() is not None:
            # Command failed immediately
            stdout, _ = metrics_process.communicate()
            raise RuntimeError(f"kubectl failed: {stdout.decode()}")
            
        return {"status": "started", "url": "http://localhost:3000"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics/stop")
def stop_metrics():
    global metrics_process
    if metrics_process:
        metrics_process.terminate()
        metrics_process = None
        return {"status": "stopped"}
    return {"status": "not_running"}
