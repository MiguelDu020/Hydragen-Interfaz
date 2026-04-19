import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExporterService } from '../../../core/services/exporter.service';
import { GraphService } from '../../../core/services/graph.service';
import { HydraGenConfig } from '../../../core/models/hydragen.model';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toolbar">
      <div class="left-section">
        <h3>HydraGen Console</h3>
      </div>

      <div class="palette">
        <div
          class="palette-item"
          draggable="true"
          (dragstart)="onDragStart($event, 'service')"
          title="Arrastra al lienzo para agregar un servicio"
        >
          <div class="item-icon">◉</div>
          <span>Add Service</span>
        </div>
      </div>

      <div class="right-section">
        <button class="btn" (click)="clearGraph()" title="Limpiar lienzo">
          Clear
        </button>
        <button class="btn" (click)="loadExample()" title="Cargar ejemplo HydraGen">
          Example
        </button>
        <button class="btn primary" (click)="exportJson()" title="Exportar JSON HydraGen">
          Export JSON
        </button>
        <button class="btn accent" (click)="preview()" title="Vista previa">
          Preview
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border-bottom: 1px solid #333;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 12px 24px;
      min-height: 64px;
    }

    .left-section {
      flex-shrink: 0;
    }

    .left-section h3 {
      margin: 0;
      color: #e0e0e0;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    .palette {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }

    .palette-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      background: #151515;
      color: #d4d4d4;
      cursor: grab;
      user-select: none;
      transition: all 0.2s ease;
    }

    .palette-item:hover {
      border-color: #007acc;
      box-shadow: 0 0 0 1px rgba(0, 122, 204, 0.35);
    }

    .palette-item:active {
      cursor: grabbing;
    }

    .item-icon {
      color: #9aa0a6;
      font-size: 14px;
      line-height: 1;
    }

    .right-section {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .btn {
      border: 1px solid #3a3a3a;
      background: #171717;
      color: #ddd;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn:hover:not(:disabled) {
      border-color: #5a5a5a;
      background: #1d1d1d;
    }

    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn.primary {
      border-color: #007acc;
      color: #d9efff;
      background: #0f2535;
    }

    .btn.primary:hover:not(:disabled) {
      background: #133044;
    }

    .btn.accent {
      border-color: #2f9e5a;
      color: #d8f5e3;
      background: #153123;
    }

    .btn.accent:hover:not(:disabled) {
      background: #1a3e2c;
    }
  `]
})
export class ToolbarComponent {
  @Output() openPreview = new EventEmitter<void>();

  constructor(
    private exporterService: ExporterService,
    private graphService: GraphService
  ) {}

  onDragStart(event: DragEvent, type: string): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('type', type);
    event.dataTransfer.effectAllowed = 'copy';
  }

  exportJson(): void {
    const content = this.exporterService.exportToJson();
    this.exporterService.downloadFile(content, 'application_description.json', 'application/json');
  }

  clearGraph(): void {
    const graph = this.graphService.getGraph();
    if (graph) graph.clearCells();
  }

  loadExample(): void {
    const example: HydraGenConfig = {
      settings: {
        logging: false,
        development: false,
        base_image: 'ubuntu:20.04'
      },
      cluster_latencies: [
        { src: 'cluster1', dest: 'cluster2', latency: 25 }
      ],
      services: [
        {
          name: 'frontend',
          protocol: 'http',
          clusters: [{ cluster: 'cluster1', replicas: 2, namespace: 'default' }],
          resources: {
            limits: { cpu: '1000m', memory: '1024Mi' },
            requests: { cpu: '500m', memory: '512Mi' }
          },
          processes: 0,
          readiness_probe: 1,
          endpoints: [
            {
              name: 'home',
              execution_mode: 'sequential',
              cpu_complexity: { execution_time: 0.2, threads: 1 },
              network_complexity: {
                forward_requests: 'synchronous',
                response_payload_size: 64,
                called_services: [
                  {
                    service: 'backend',
                    endpoint: 'api',
                    port: 80,
                    protocol: 'http',
                    traffic_forward_ratio: 1,
                    request_payload_size: 16
                  }
                ]
              }
            }
          ],
          resilience_patterns: {}
        },
        {
          name: 'backend',
          protocol: 'http',
          clusters: [{ cluster: 'cluster2', replicas: 1, namespace: 'default' }],
          resources: {
            limits: { cpu: '1000m', memory: '1024Mi' },
            requests: { cpu: '500m', memory: '512Mi' }
          },
          processes: 0,
          readiness_probe: 1,
          endpoints: [
            {
              name: 'api',
              execution_mode: 'sequential',
              cpu_complexity: { execution_time: 0.3, threads: 2 },
              network_complexity: {
                forward_requests: 'synchronous',
                response_payload_size: 128,
                called_services: []
              }
            }
          ],
          resilience_patterns: {}
        }
      ]
    };

    this.graphService.importConfig(example);
  }

  preview(): void {
    this.openPreview.emit();
  }
}
