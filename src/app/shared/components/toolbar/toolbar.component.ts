import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExporterService } from '../../../core/services/exporter.service';
import { GraphService } from '../../../core/services/graph.service';
import { HydraGenConfig } from '../../../core/models/hydragen.model';
import { ExecutionModalComponent } from '../../../features/execution-modal/execution-modal.component';
import { ThemeService } from '../../../core/services/theme.service';
import { ExecutionService } from '../../../core/services/execution.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ExecutionModalComponent],
  template: `
    <div class="toolbar">
      <div class="left-section">
        <h3>HydraGen Console</h3>
        <div class="history-btns">
          <button class="icon-btn" (click)="undo()" title="Deshacer (Ctrl+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v6h6"/><path d="M3 13C5 7 10 3 16 3a9 9 0 0 1 6 15.5"/>
            </svg>
          </button>
          <button class="icon-btn" (click)="redo()" title="Rehacer (Ctrl+Y)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 7v6h-6"/><path d="M21 13C19 7 14 3 8 3a9 9 0 0 0-6 15.5"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="right-section">
        <button class="btn" (click)="clearGraph()" title="Limpiar lienzo">Clear</button>
        <button class="btn" (click)="loadExample()" title="Cargar ejemplo">Example</button>
        <label class="btn" title="Importar JSON" style="cursor:pointer;">
          Import JSON
          <input #fileInput type="file" accept=".json" style="display:none"
            (change)="importJson($event)">
        </label>
        <button class="btn primary" (click)="exportJson()" title="Exportar JSON HydraGen">Export JSON</button>
        <button class="btn accent" (click)="preview()" title="Vista previa">Download</button>

        <div class="separator"></div>

        <button
          *ngIf="hasFaults"
          class="btn faults-apply"
          (click)="applyFaultInjections()"
          [disabled]="faultActionRunning || !benchmarkCompleted"
          [title]="faultButtonTitle('Aplicar inyección de fallas a la arquitectura desplegada')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {{ applyingFaults ? 'Aplicando...' : 'Aplicar Fallas' }}
        </button>

        <button
          *ngIf="benchmarkCompleted"
          class="btn faults-remove"
          (click)="removeFaultInjections()"
          [disabled]="faultActionRunning"
          [title]="faultButtonTitle('Quitar inyección de fallas de la arquitectura desplegada')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M8 6V4h8v2"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v5"/>
            <path d="M14 11v5"/>
          </svg>
          {{ removingFaults ? 'Quitando...' : 'Quitar Fallas' }}
        </button>

        <button
          class="btn execute"
          id="btn-execute-benchmark"
          (click)="openExecutionModal()"
          [disabled]="!hasNodes"
          [title]="hasNodes ? 'Ejecutar el pipeline HydraGen completo' : 'Agrega al menos un servicio al canvas'"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          Ejecutar Benchmark
        </button>

        <div class="separator"></div>

        <button class="icon-btn theme-toggle" (click)="toggleTheme()" [title]="isDark ? 'Activar tema claro' : 'Activar tema oscuro'">
          <svg *ngIf="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg *ngIf="!isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Execution Modal -->
    <app-execution-modal
      *ngIf="showExecutionModal"
      (closed)="showExecutionModal = false"
      (benchmarkCompleted)="markBenchmarkCompleted()"
    ></app-execution-modal>

    <!-- Toast Notification -->
    <div class="toast" *ngIf="showToast" [class.error]="toastType === 'error'">
      {{ toastMessage }}
    </div>
  `,
  styles: [`
    :host { display: block; background: var(--bg-card); border-bottom: 1px solid var(--border-color); }
    .toolbar { display: flex; align-items: center; gap: 20px; padding: 12px 24px; min-height: 56px; }

    .left-section {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .left-section h3 { margin: 0; color: var(--text-primary); font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }

    .history-btns {
      display: flex;
      gap: 4px;
      border-left: 1px solid var(--border-color);
      padding-left: 12px;
    }
    .icon-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      width: 30px;
      height: 30px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      padding: 0;
      &:hover { border-color: var(--text-secondary); color: var(--text-primary); background: var(--bg-surface); }
    }

    .right-section { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; }
    .btn {
      border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);
      padding: 7px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s ease;
      &:hover:not(:disabled) { border-color: var(--text-secondary); background: var(--bg-hover); }
      &.primary { border-color: var(--accent-blue); color: var(--node-badge-text); background: var(--node-badge-bg); &:hover { background: var(--bg-accent-subtle); } }
      &.accent  { border-color: var(--success); color: var(--success); background: var(--bg-success-subtle); &:hover { background: rgba(34, 197, 94, 0.15); } }
      &.execute {
        border-color: #22c55e;
        color: #000;
        background: linear-gradient(135deg, #00b37e, #22c55e);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #00c98c, #2ecc71);
          box-shadow: 0 0 14px rgba(34,197,94,0.4);
        }
        &:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
      }
      &.faults-apply {
        border-color: #f59e0b;
        color: #fff;
        background: linear-gradient(135deg, #d97706, #f59e0b);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #ea580c, #d97706);
          box-shadow: 0 0 14px rgba(245,158,11,0.4);
        }
        &:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
      }
      &.faults-remove {
        border-color: #f87171;
        color: #fff;
        background: linear-gradient(135deg, #b91c1c, #ef4444);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #dc2626, #f87171);
          box-shadow: 0 0 14px rgba(248,113,113,0.35);
        }
        &:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
      }
    }
    .separator {
      width: 1px;
      height: 22px;
      background: var(--border-color);
      margin: 0 4px;
    }
    .theme-toggle {
      border: none;
      background: transparent;
      color: var(--text-secondary);
      &:hover { color: var(--text-primary); background: var(--bg-surface); }
    }

    .toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px; border-radius: 8px; font-size: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      animation: fadeInUp 0.2s ease; white-space: nowrap;
      background: #0f3d24; border: 1px solid #22c55e; color: #bbf7d0;
      z-index: 9999;
    }
    .toast.error {
      background: #450a0a; border: 1px solid #f87171; color: #fecaca;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `]
})
export class ToolbarComponent implements OnInit {
  @Output() openPreview = new EventEmitter<void>();

  showExecutionModal = false;
  applyingFaults = false;
  removingFaults = false;
  benchmarkCompleted = false;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimer: any;

  constructor(
    private exporterService: ExporterService,
    private graphService: GraphService,
    private themeService: ThemeService,
    private executionService: ExecutionService
  ) { }

  ngOnInit(): void {
    this.benchmarkCompleted = localStorage.getItem('hydragen_benchmark_completed') === 'true';
  }

  get isDark(): boolean {
    return this.themeService.getCurrentTheme() === 'dark';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  get hasNodes(): boolean {
    const g = this.graphService.getGraph();
    return !!g && g.getNodes().length > 0;
  }

  openExecutionModal(): void {
    if (this.hasNodes) this.showExecutionModal = true;
  }

  get hasFaults(): boolean {
    const g = this.graphService.getGraph();
    if (!g) return false;
    return g.getNodes().some(n => {
      const data = n.getData() || {};
      return data.fault_injection && data.fault_injection.type && data.fault_injection.type !== 'none';
    });
  }

  get faultActionRunning(): boolean {
    return this.applyingFaults || this.removingFaults;
  }

  markBenchmarkCompleted(): void {
    this.benchmarkCompleted = true;
    localStorage.setItem('hydragen_benchmark_completed', 'true');
  }

  faultButtonTitle(baseTitle: string): string {
    if (!this.benchmarkCompleted) return 'Ejecuta correctamente el benchmark antes de aplicar o quitar fallas';
    if (this.applyingFaults) return 'Aplicando inyecciones de fallas...';
    if (this.removingFaults) return 'Quitando inyecciones de fallas...';
    return baseTitle;
  }

  applyFaultInjections(): void {
    if (this.faultActionRunning || !this.benchmarkCompleted) return;
    this.applyingFaults = true;

    let config: any;
    try {
      config = this.exporterService.generateConfig({ includeFaults: true });
    } catch (e: any) {
      this.applyingFaults = false;
      this.removingFaults = false;
      this.toastMessage = 'Error al generar la configuración: ' + e.message;
      this.toastType = 'error';
      this.showToast = true;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.showToast = false; }, 4000);
      return;
    }

    this.executionService.applyFaults(config).subscribe({
      next: (res) => {
        this.applyingFaults = false;
        this.toastMessage = res.message || 'Fallas aplicadas correctamente';
        this.toastType = res.status === 'ok' ? 'success' : 'error';
        this.showToast = true;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.showToast = false; }, res.status === 'ok' ? 3000 : 5000);
      },
      error: (err) => {
        this.applyingFaults = false;
        this.toastMessage = 'Error al generar archivos de fallas: ' + (err.error?.detail || err.message || 'No se pudo conectar al backend.');
        this.toastType = 'error';
        this.showToast = true;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.showToast = false; }, 4000);
      }
    });
  }

  removeFaultInjections(): void {
    if (this.faultActionRunning || !this.benchmarkCompleted) return;
    this.removingFaults = true;

    let config: any;
    try {
      config = this.exporterService.generateConfig({ includeFaults: true });
    } catch (e: any) {
      this.removingFaults = false;
      this.toastMessage = 'Error al generar la configuracion: ' + e.message;
      this.toastType = 'error';
      this.showToast = true;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.showToast = false; }, 4000);
      return;
    }

    this.executionService.removeFaults(config).subscribe({
      next: (res) => {
        this.removingFaults = false;
        this.toastMessage = res.message || 'Fallas removidas correctamente';
        this.toastType = res.status === 'ok' ? 'success' : 'error';
        this.showToast = true;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.showToast = false; }, res.status === 'ok' ? 3000 : 5000);
      },
      error: (err) => {
        this.removingFaults = false;
        this.toastMessage = 'Error al remover fallas: ' + (err.error?.detail || err.message || 'No se pudo conectar al backend.');
        this.toastType = 'error';
        this.showToast = true;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.showToast = false; }, 4000);
      }
    });
  }

  undo() {
    const g = this.graphService.getGraph();
    if (g) (g as any).undo?.();
  }

  redo() {
    const g = this.graphService.getGraph();
    if (g) (g as any).redo?.();
  }

  clearGraph() {
    const g = this.graphService.getGraph();
    if (g) g.clearCells();
  }

  exportJson() {
    try {
      const content = this.exporterService.exportToJson();
      this.exporterService.downloadFile(content, 'application_description.json', 'application/json');
    } catch (e: any) { alert('Error al exportar: ' + e.message); }
  }

  preview() { this.openPreview.emit(); }

  importJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config: HydraGenConfig = JSON.parse(e.target?.result as string);
        this.graphService.importConfig(config);
      } catch (err: any) {
        alert('JSON inválido: ' + err.message);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  loadExample() {
    const example: HydraGenConfig = {
      settings: { 
        logging: true, 
        development: true, 
        base_image: 'ubuntu:20.04',
        clusters: [
          { name: 'cluster1', namespace: 'hydragen'}
        ]
      },
      services: [
        {
          name: 'api-gateway',
          protocol: 'http',
          replicas: 2,
          clusters: [{ cluster: 'cluster1', namespace: 'hydragen' }],
          resources: { limits: { cpu: '500m', memory: '512M' }, requests: { cpu: '250m', memory: '256M' } },
          processes: 1,
          readiness_probe: 2,
          endpoints: [{
            name: 'end1',
            execution_mode: 'sequential',
            cpu_complexity: { execution_time: 0.002, threads: 1 },
            network_complexity: {
              forward_requests: 'synchronous',
              response_payload_size: 256,
              called_services: [{
                service: 'service-backend',
                endpoint: 'end1',
                port: 80, protocol: 'http',
                traffic_forward_ratio: 1, request_payload_size: 128,
                active_circuit_breaker: true
              }]
            },
            resilience_parameters: {
              timeout: { duration_s: 3 },
              retry: { max_attempts: 3, backoff_ms: 100, backoff_multiplier: 2.0, max_backoff_ms: 5000 }
            }
          }]
        },
        {
          name: 'service-backend',
          protocol: 'http',
          replicas: 1,
          clusters: [{ cluster: 'cluster1', namespace: 'hydragen' }],
          resources: { limits: { cpu: '300m', memory: '256M' }, requests: { cpu: '150m', memory: '128M' } },
          processes: 1,
          readiness_probe: 2,
          endpoints: [{
            name: 'end1',
            execution_mode: 'sequential',
            cpu_complexity: { execution_time: 0.005, threads: 1 },
            network_complexity: { forward_requests: 'none', response_payload_size: 512, called_services: [] }
          }]
        }
      ]
    };
    this.graphService.importConfig(example);
  }
}
