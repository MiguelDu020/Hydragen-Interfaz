import {
  Component,
  ElementRef,
  EventEmitter,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

import { ExporterService } from '../../core/services/exporter.service';
import {
  ExecutionService,
  ExecutionStatus,
  LogLine,
} from '../../core/services/execution.service';

type ModalView = 'config' | 'running' | 'metrics';
type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface PipelineStep {
  num: number;
  label: string;
  status: StepStatus;
}

@Component({
  selector: 'app-execution-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe],
  templateUrl: './execution-modal.component.html',
  styleUrls: ['./execution-modal.component.scss'],
})
export class ExecutionModalComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();
  @ViewChild('logsPanel') logsPanel!: ElementRef<HTMLDivElement>;

  // ── Config view ────────────────────────────────────────────────────────────
  hydragenPath = '';
  hydragenPaths: string[] = [];
  sshPassword = '';
  sudoPassword = '';
  verifyBackend = true;

  // ── State ──────────────────────────────────────────────────────────────────
  view: ModalView = 'config';
  jobId = '';
  jobStatus: ExecutionStatus['status'] | 'idle' = 'idle';
  currentStep = 0;
  stepName = '';
  errorMessage = '';
  elapsedSeconds = 0;
  metricsUrl = 'http://localhost:3000';
  loadingMetrics = false;

  logs: LogLine[] = [];

  steps: PipelineStep[] = [
    { num: 1, label: 'Guardar configuración', status: 'pending' },
    { num: 2, label: 'Generar imagen Docker', status: 'pending' },
    { num: 3, label: 'Distribuir imagen a nodos', status: 'pending' },
    { num: 4, label: 'Configurar kubectl', status: 'pending' },
    { num: 5, label: 'Desplegar en Kubernetes', status: 'pending' },
  ];

  // ── UI helpers ─────────────────────────────────────────────────────────────
  isStarting = false;
  isCancelling = false;
  backendError = '';
  sshWarningAccepted = false;

  private subs: Subscription[] = [];
  private timerSub?: Subscription;

  constructor(
    private exporterService: ExporterService,
    private executionService: ExecutionService,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.loadPaths();
  }

  private loadPaths(): void {
    try {
      const saved = localStorage.getItem('hydragen_paths');
      if (saved) {
        this.hydragenPaths = JSON.parse(saved);
        if (this.hydragenPaths.length > 0) {
          this.hydragenPath = this.hydragenPaths[0]; // Set the last successful one as default
        }
      } else {
        this.hydragenPath = '/home/user/hydragen'; // Default fallback
      }
    } catch (e) {
      console.warn('Error loading paths from localStorage', e);
      this.hydragenPath = '/home/user/hydragen';
    }
  }

  private saveSuccessfulPath(path: string): void {
    if (!path) return;
    // Remove if already exists to move it to the front (most recent)
    const filtered = this.hydragenPaths.filter(p => p !== path);
    this.hydragenPaths = [path, ...filtered].slice(0, 5); // Keep last 5
    localStorage.setItem('hydragen_paths', JSON.stringify(this.hydragenPaths));
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ── Public helpers exposed to template ────────────────────────────────────
  get progressPercent(): number {
    const done = this.steps.filter((s) => s.status === 'done').length;
    return Math.round((done / this.steps.length) * 100);
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get isRunning(): boolean {
    return this.jobStatus === 'running';
  }

  get isCompleted(): boolean {
    return this.jobStatus === 'completed';
  }

  get isFailed(): boolean {
    return this.jobStatus === 'failed';
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  iniciar(): void {
    // Validate: confirm no SSH password if empty
    if (!this.sshPassword && !this.sshWarningAccepted) {
      this.sshWarningAccepted = true; // flip flag, template shows confirmation
      return;
    }
    this._startExecution();
  }

  confirmNoSsh(): void {
    this.sshWarningAccepted = true;
    this._startExecution();
  }

  cancelar(): void {
    if (!this.jobId || this.jobStatus !== 'running') return;
    
    this.isCancelling = true;
    const sub = this.executionService.cancelBenchmark(this.jobId).subscribe({
      next: () => {
        this.isCancelling = false;
        // El estado cambiará a 'failed' mediante el polling o la respuesta del backend
      },
      error: (err) => {
        console.error('Error al cancelar:', err);
        this.isCancelling = false;
      }
    });
    this.subs.push(sub);
  }

  cancelSshWarning(): void {
    this.sshWarningAccepted = false;
  }

  close(): void {
    this.cleanup();
    this.closed.emit();
  }

  retry(): void {
    this.view = 'config';
    this.jobStatus = 'idle';
    this.jobId = '';
    this.logs = [];
    this.elapsedSeconds = 0;
    this.currentStep = 0;
    this.errorMessage = '';
    this.sshWarningAccepted = false;
    this.steps.forEach((s) => (s.status = 'pending'));
    this.timerSub?.unsubscribe();
    this.stopMetrics();
  }

  logLineClass(log: LogLine): string {
    if (log.level === 'ERROR') return 'log-error';
    if (log.level === 'WARN') return 'log-warn';
    if (log.line.startsWith('✓')) return 'log-success';
    if (log.line.startsWith('$')) return 'log-cmd';
    return 'log-info';
  }

  stepIcon(s: PipelineStep): string {
    switch (s.status) {
      case 'done': return '✓';
      case 'running': return '⟳';
      case 'error': return '✗';
      default: return '○';
    }
  }

  stepLabel(s: PipelineStep): string {
    switch (s.status) {
      case 'done': return 'Completado';
      case 'running': return 'En progreso...';
      case 'error': return 'Fallido';
      default: return 'Pendiente';
    }
  }

  formatElapsed(): string {
    const m = Math.floor(this.elapsedSeconds / 60);
    const s = this.elapsedSeconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // ── Metrics Actions ────────────────────────────────────────────────────────
  showMetrics(): void {
    this.view = 'metrics';
    this.loadingMetrics = true;
    const sub = this.executionService.startMetrics().subscribe({
      next: (res) => {
        this.metricsUrl = res.url;
        this.loadingMetrics = false;
      },
      error: (err) => {
        console.error('Error starting metrics:', err);
        this.loadingMetrics = false;
        // Even if error, try to show the iframe in case it's already running manually
      }
    });
    this.subs.push(sub);
  }

  hideMetrics(): void {
    this.view = 'running';
  }

  private stopMetrics(): void {
    const sub = this.executionService.stopMetrics().subscribe({
      error: (err) => console.warn('Error stopping metrics:', err)
    });
    this.subs.push(sub);
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private _startExecution(): void {
    this.isStarting = true;
    this.backendError = '';

    const doExecute = () => {
      let config: any;
      try {
        config = this.exporterService.generateConfig();
      } catch (e: any) {
        this.backendError = `Error al generar configuración: ${e.message}`;
        this.isStarting = false;
        return;
      }

      const sub = this.executionService
        .executeBenchmark(config, this.hydragenPath, this.sudoPassword, this.sshPassword)
        .subscribe({
          next: ({ job_id }) => {
            this.jobId = job_id;
            this.jobStatus = 'running';
            this.view = 'running';
            this.isStarting = false;
            this.startTimer();
            this.subscribeToLogs(job_id);
            this.pollStatus(job_id);
          },
          error: (err) => {
            this.backendError = 'No se pudo conectar al backend. ¿Está corriendo en el puerto 8000?';
            this.isStarting = false;
          },
        });
      this.subs.push(sub);
    };

    if (this.verifyBackend) {
      const sub = this.executionService.checkHealth().subscribe({
        next: () => doExecute(),
        error: () => {
          this.backendError =
            'Backend no disponible en http://localhost:8000. Ejecuta backend/run.sh primero.';
          this.isStarting = false;
        },
      });
      this.subs.push(sub);
    } else {
      doExecute();
    }
  }

  private startTimer(): void {
    this.elapsedSeconds = 0;
    this.timerSub = interval(1000).subscribe(() => {
      this.ngZone.run(() => this.elapsedSeconds++);
    });
  }

  private subscribeToLogs(jobId: string): void {
    const sub = this.executionService.streamLogs(jobId).subscribe({
      next: (log) => {
        this.logs.push(log);
        setTimeout(() => {
          if (this.logsPanel?.nativeElement) {
            const el = this.logsPanel.nativeElement;
            el.scrollTop = el.scrollHeight;
          }
        }, 30);
      },
      error: (err) => {
        console.warn('SSE error:', err);
      },
      complete: () => {
        // stream closed naturally
      },
    });
    this.subs.push(sub);
  }

  private pollStatus(jobId: string): void {
    const sub = interval(1000)
      .pipe(takeWhile(() => this.jobStatus === 'running'))
      .subscribe(() => {
        const innerSub = this.executionService.getStatus(jobId).subscribe({
          next: (status: ExecutionStatus) => {
            this.currentStep = status.current_step;
            this.stepName = status.step_name;

            // Update step visual states
            this.steps.forEach((s) => {
              if (s.num < status.current_step) {
                s.status = 'done';
              } else if (s.num === status.current_step) {
                s.status = status.status === 'failed' ? 'error' : 'running';
              } else {
                s.status = 'pending';
              }
            });

            if (status.status === 'completed') {
              this.jobStatus = 'completed';
              this.saveSuccessfulPath(this.hydragenPath);
              this.steps.forEach((s) => (s.status = 'done'));
              this.timerSub?.unsubscribe();
            } else if (status.status === 'failed') {
              this.jobStatus = 'failed';
              this.errorMessage = status.error ?? 'Error desconocido';
              this.timerSub?.unsubscribe();
            }
          },
          error: () => {
            // ignore transient poll errors
          },
        });
        this.subs.push(innerSub);
      });
    this.subs.push(sub);
  }

  private cleanup(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    this.timerSub?.unsubscribe();
    this.executionService.closeStream();
    this.stopMetrics();
  }
}
