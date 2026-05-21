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

TOTAL_STEPS = 5


# ── Request / Response Models ─────────────────────────────────────────────────
class ExecuteRequest(BaseModel):
    config: dict
    hydragen_path: str = "/home/user/hydragen"
    sudo_password: Optional[str] = ""
    ssh_password: Optional[str] = ""

    cleanup_namespace: bool = False
    namespace: Optional[str] = "default"


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


class ApplyFaultsRequest(BaseModel):
    config: dict
    sudo_password: Optional[str] = ""


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
    jobs[job_id]["process"] = process

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


def generate_virtual_service_yaml(service_name: str, protocol: str, fault_config: dict, namespace: str) -> str:
    """Generate VirtualService YAML content with fault injection settings.
    Uses Istio v1beta1 API and names files as `<service>-<fault_type>.yaml`.
    """
    fault_type = fault_config.get("type", "none")
    percentage = fault_config.get("percentage", 100)
    try:
        percentage_val = float(percentage)
    except Exception:
        percentage_val = 100.0

    # Determine file base name
    suffix = fault_type if fault_type != "none" else "fault-injection"
    yaml_name = f"{service_name}-{suffix}"
    route_field = "  http:"
    if (protocol or "http").lower() == "grpc":
        route_field = "  http: # Istio HTTPRoute also handles gRPC/HTTP2 traffic"

    if fault_type == "delay":
        delay_s = fault_config.get("delay_s", 1.0)
        return f"""apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: {yaml_name}
  namespace: {namespace}
spec:
  hosts:
  - {service_name}
{route_field}
  - fault:
      delay:
        percentage:
          value: {percentage_val}
        fixedDelay: {delay_s}s
    route:
    - destination:
        host: {service_name}
"""
    elif fault_type == "abort":
        if protocol.lower() == "grpc":
            grpc_status = fault_config.get("grpc_status") or "UNAVAILABLE"
            return f"""apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: {yaml_name}
  namespace: {namespace}
spec:
  hosts:
  - {service_name}
{route_field}
  - fault:
      abort:
        percentage:
          value: {percentage_val}
        grpcStatus: "{grpc_status}"
    route:
    - destination:
        host: {service_name}
"""
        else:
            try:
                http_status = int(fault_config.get("http_status") or 503)
            except Exception:
                http_status = 503
            return f"""apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: {yaml_name}
  namespace: {namespace}
spec:
  hosts:
  - {service_name}
{route_field}
  - fault:
      abort:
        percentage:
          value: {percentage_val}
        httpStatus: {http_status}
    route:
    - destination:
        host: {service_name}
"""
    return ""


def apply_faults_for_service(
    service: dict,
    job_id: str,
    step_num: int,
    step_name: str,
    cwd: str
) -> bool:
    """Apply or remove Istio fault injection VirtualService for a service across its clusters."""
    service_name = service.get("name")
    protocol = service.get("protocol", "http")
    fault_config = service.get("fault_injection") or {}
    fault_type = fault_config.get("type", "none")
    
    # Each service has a list of clusters
    clusters = service.get("clusters", [])
    if not clusters:
        clusters = [{"cluster": "", "namespace": "default"}]
        
    success = True
    for c in clusters:
        context = c.get("cluster", "")
        namespace = c.get("namespace", "default")
        context_flag = f"--context {context}" if context else ""
        
        if fault_type != "none":
            yaml_content = generate_virtual_service_yaml(service_name, protocol, fault_config, namespace)
            if not yaml_content:
                continue
                
            # Write YAML to a persistent file in the 'faults' directory
            faults_dir = os.path.join(cwd, "faults")
            os.makedirs(faults_dir, exist_ok=True)
            file_name = f"{service_name}-{fault_type}.yaml"
            file_path = os.path.join(faults_dir, file_name)
            try:
                with open(file_path, "w") as f:
                    f.write(yaml_content)
                cmd = f"kubectl apply {context_flag} -n {namespace} -f faults/{file_name}"
                rc = run_command(cmd, cwd, job_id, step_num, step_name)
                if rc != 0:
                    success = False
            except Exception as e:
                _append_log(job_id, f"Error writing YAML for {service_name}: {e}", step_num, "ERROR")
                success = False
            # Do NOT delete the file; keep it for user reference

        else:
            # Delete if type is none
            for f_type in ["delay", "abort"]:
                cmd = f"kubectl delete virtualservice {service_name}-{f_type} {context_flag} -n {namespace} --ignore-not-found"
                rc = run_command(cmd, cwd, job_id, step_num, step_name)
                if rc != 0:
                    success = False
                
    return success


# ── Pipeline execution (runs in a background thread) ─────────────────────────
def execute_pipeline(
    job_id: str,
    config: dict,
    hydragen_path: str,
    sudo_password: str,
    ssh_password: str,
    cleanup_namespace: bool,
    namespace: str
) -> None:
    """Full HydraGen pipeline — runs in a dedicated thread."""
    # Carpeta donde están los scripts (backend/)
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Rutas dentro del repositorio de HydraGen
    input_dir = os.path.join(hydragen_path, "generator/input")
    input_file = os.path.join(input_dir, "description.json")

    try:
        job_total_steps = 5
        jobs[job_id]["total_steps"] = job_total_steps
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
            if jobs[job_id]["status"] == "failed": return # Cancelled
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
            if jobs[job_id]["status"] == "failed": return # Cancelled
            raise RuntimeError(f"Push de imagen falló con código de salida {rc}")

        _append_log(job_id, "✓ Imagen distribuida a todos los nodos", 3, "INFO")

        # ── STEP 4: Cleanup namespace ─────────────────────────────
        if cleanup_namespace:
            run_path = hydragen_path

            rc = run_command(
                f"kubectl delete all --all -n {namespace}",
                run_path,
                job_id,
                4,
                f"Limpiando namespace '{namespace}'..."
            )

            if rc != 0:
                if jobs[job_id]["status"] == "failed":
                    return

                raise RuntimeError(
                    f"Cleanup del namespace falló con código {rc}"
                )

            _append_log(
                job_id,
                f"✓ Namespace '{namespace}' limpiado correctamente",
                4,
                "INFO"
            )

        # ── STEP 5: deploy.sh ────────────────────────────────────────────────
        #deploy_script = os.path.join(backend_dir, "deploy.sh")
        deploy_script = "deploy.sh"
        run_path = os.path.join(hydragen_path, "generator")
        rc = run_command(
            f"bash {deploy_script} input/description.json",
            run_path, job_id, 5,
            "Desplegando microservicios en Kubernetes..."
        )
        if rc != 0:
            if jobs[job_id]["status"] == "failed": return # Cancelled
            raise RuntimeError(f"deploy.sh falló con código de salida {rc}")

        _append_log(job_id, "✓ Benchmark desplegado correctamente en Kubernetes", 5, "INFO")

        # ── Done ─────────────────────────────────────────────────────────────
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["step_name"] = "Pipeline completado exitosamente"
        jobs[job_id]["current_step"] = job_total_steps

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
        "created_at": datetime.utcnow(),
        "total_steps": 5
    }

    t = threading.Thread(
        target=execute_pipeline,
        args=(job_id, req.config, req.hydragen_path, req.sudo_password or "", req.ssh_password or "", req.cleanup_namespace,
        req.namespace or ""),
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
        total_steps=job.get("total_steps", TOTAL_STEPS),
        step_name=job["step_name"],
        error=job.get("error")
    )
@app.post("/cancel/{job_id}")
def cancel_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' no encontrado")

    if job["status"] != "running":
        return {"status": "already_stopped", "message": f"El job ya está en estado {job['status']}"}

    process: Optional[subprocess.Popen] = job.get("process")
    if process and process.poll() is None:
        process.terminate()
        # Mark as failed so the pipeline thread stops
        job["status"] = "failed"
        job["error"] = "Ejecución cancelada por el usuario"
        _append_log(job_id, "✖ Ejecución cancelada por el usuario", job["current_step"], "WARN")
        return {"status": "cancelled"}
    
    # If no process but status was running (edge case)
    job["status"] = "failed"
    job["error"] = "Ejecución detenida"
    return {"status": "stopped"}


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


@app.post("/apply-faults")
def apply_faults(req: ApplyFaultsRequest):
    # Directory to store generated fault YAML files
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    faults_dir = os.path.join(backend_dir, "faults")
    os.makedirs(faults_dir, exist_ok=True)

    # Clean existing YAML files in faults/ directory to prevent stale config files
    for item in os.listdir(faults_dir):
        if item.endswith(".yaml"):
            try:
                os.remove(os.path.join(faults_dir, item))
            except Exception as e:
                pass

    services = req.config.get("services", [])
    logs = []
    success = True

    for service in services:
        service_name = service.get("name")
        protocol = service.get("protocol", "http")
        fault_config = service.get("fault_injection") or {}
        fault_type = fault_config.get("type", "none")
        
        clusters = service.get("clusters", [])
        if not clusters:
            clusters = [{"cluster": "", "namespace": "default"}]
            
        for c in clusters:
            namespace = c.get("namespace", "default")
            
            if fault_type != "none":
                yaml_content = generate_virtual_service_yaml(service_name, protocol, fault_config, namespace)
                if not yaml_content:
                    continue
                
                file_name = f"{service_name}-{fault_type}.yaml"
                file_path = os.path.join(faults_dir, file_name)
                try:
                    with open(file_path, "w") as f:
                        f.write(yaml_content)
                    logs.append(f"Archivo de falla generado: faults/{file_name}")
                except Exception as e:
                    logs.append(f"Error escribiendo YAML para {service_name}: {e}")
                    success = False
            else:
                pass

    return {
        "status": "ok" if success else "error",
        "message": "Archivos de fallas generados correctamente" if success else "Error al generar archivos de fallas",
        "logs": logs
    }

