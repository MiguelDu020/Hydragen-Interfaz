import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExporterService } from '../../../core/services/exporter.service';
import { GraphService } from '../../../core/services/graph.service';
import { HydraGenConfig } from '../../../core/models/hydragen.model';
import { ExecutionModalComponent } from '../../../features/execution-modal/execution-modal.component';

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
      </div>
    </div>

    <!-- Execution Modal -->
    <app-execution-modal
      *ngIf="showExecutionModal"
      (closed)="showExecutionModal = false"
    ></app-execution-modal>
  `,
  styles: [`
    :host { display: block; background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); border-bottom: 1px solid #333; }
    .toolbar { display: flex; align-items: center; gap: 20px; padding: 12px 24px; min-height: 56px; }

    .left-section {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .left-section h3 { margin: 0; color: #e0e0e0; font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }

    .history-btns {
      display: flex;
      gap: 4px;
      border-left: 1px solid #2a2a2a;
      padding-left: 12px;
    }
    .icon-btn {
      background: transparent;
      border: 1px solid #2a2a2a;
      color: #a0a0a0;
      width: 30px;
      height: 30px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      padding: 0;
      &:hover { border-color: #4a4a4a; color: #e0e0e0; background: #1d1d1d; }
    }

    .right-section { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; }
    .btn {
      border: 1px solid #3a3a3a; background: #171717; color: #ddd;
      padding: 7px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s ease;
      &:hover:not(:disabled) { border-color: #5a5a5a; background: #1d1d1d; }
      &.primary { border-color: #007acc; color: #d9efff; background: #0f2535; &:hover { background: #133044; } }
      &.accent  { border-color: #2f9e5a; color: #d8f5e3; background: #153123; &:hover { background: #1a3e2c; } }
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
    }
    .separator {
      width: 1px;
      height: 22px;
      background: #2a2a2a;
      margin: 0 4px;
    }
  `]
})
export class ToolbarComponent {
  @Output() openPreview = new EventEmitter<void>();

  showExecutionModal = false;

  constructor(
    private exporterService: ExporterService,
    private graphService: GraphService
  ) {}

  get hasNodes(): boolean {
    const g = this.graphService.getGraph();
    return !!g && g.getNodes().length > 0;
  }

  openExecutionModal(): void {
    if (this.hasNodes) this.showExecutionModal = true;
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
    const file  = input.files?.[0];
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
      settings: { logging: false, development: false, base_image: '' },
      services: [
        {
          name: 'api-gateway',
          protocol: 'http',
          clusters: [{ cluster: 'cluster1', replicas: 2, namespace: 'hydragen' }],
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
                active_timeout: true, active_retry: true, active_fallback: false
              }]
            },
            resilience_patterns: {
              timeout: { duration_ms: 3000 },
              retry:   { max_attempts: 3, backoff_ms: 100, backoff_multiplier: 2.0, max_backoff_ms: 5000 }
            }
          }]
        },
        {
          name: 'service-backend',
          protocol: 'http',
          clusters: [{ cluster: 'cluster1', replicas: 1, namespace: 'hydragen' }],
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
