import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Edge } from '@antv/x6';
import { GraphService } from '../../../../core/services/graph.service';

@Component({
  selector: 'app-endpoints-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="endpoints-tab">

      <div class="endpoint-item" *ngFor="let ep of endpoints; let ei = index">
        <!-- Accordion Header -->
        <div class="ep-header" (click)="toggleExpand(ei)">
          <span class="ep-arrow">{{ expandedIdx === ei ? '▼' : '▶' }}</span>
          <span class="ep-name">{{ ep.name || 'endpoint' }}</span>
          <div class="ep-badges">
            <span class="badge to" *ngIf="ep.resilience_patterns?.timeout">TO</span>
            <span class="badge rt" *ngIf="ep.resilience_patterns?.retry">RT</span>
            <span class="badge fb" *ngIf="ep.resilience_patterns?.fallback">FB</span>
          </div>
          <button class="btn-remove-ep" (click)="removeEndpoint(ei, $event)" [disabled]="endpoints.length <= 1" title="Eliminar endpoint">✕</button>
        </div>

        <!-- Accordion Body -->
        <div class="ep-body" *ngIf="expandedIdx === ei">

          <!-- General -->
          <div class="subsection-title">General</div>
          <div class="field-row">
            <div class="field">
              <label>Nombre</label>
              <input type="text" [(ngModel)]="ep.name" (ngModelChange)="emit()" placeholder="end1" />
            </div>
            <div class="field">
              <label>Execution Mode</label>
              <select [(ngModel)]="ep.execution_mode" (ngModelChange)="emit()">
                <option value="sequential">Sequential</option>
                <option value="parallel">Parallel</option>
              </select>
            </div>
          </div>

          <!-- CPU Complexity -->
          <div class="subsection-title">CPU Complexity</div>
          <div class="field-row">
            <div class="field">
              <label>Execution Time (s)</label>
              <input type="number" step="0.001" min="0" [(ngModel)]="ep.cpu_complexity.execution_time" (ngModelChange)="emit()" />
            </div>
            <div class="field">
              <label>Threads</label>
              <input type="number" min="1" [(ngModel)]="ep.cpu_complexity.threads" (ngModelChange)="emit()" />
            </div>
          </div>

          <!-- Network Complexity -->
          <div class="subsection-title">Network Complexity</div>
          <div class="field-row">
            <div class="field">
              <label>Forward Requests</label>
              <select [(ngModel)]="ep.network_complexity.forward_requests" (ngModelChange)="emit()">
                <option value="synchronous">Synchronous</option>
                <option value="asynchronous">Asynchronous</option>
                <option value="none">None</option>
              </select>
            </div>
            <div class="field">
              <label>Response Payload (chars)</label>
              <input type="number" min="0" [(ngModel)]="ep.network_complexity.response_payload_size" (ngModelChange)="emit()" />
            </div>
          </div>

          <!-- Called Services (live from graph) -->
          <div class="subsection-title">
            Conexiones salientes
            <span class="subtitle-note">— definidas en el canvas</span>
          </div>
          <ng-container *ngIf="getEdgesForEndpoint(ep.name) as edgeRows">
            <div class="empty-edges" *ngIf="edgeRows.length === 0">
              Sin conexiones salientes asignadas a este endpoint.
            </div>
            <div class="edge-row" *ngFor="let row of edgeRows">
              <div class="edge-target">
                <span class="tag">→</span>
                <strong>{{ row.targetName }}</strong>
                <span class="tag">{{ row.targetEndpoint }}</span>
              </div>
              <div class="field-row compact">
                <div class="field">
                  <label>Puerto</label>
                  <input type="number" [ngModel]="row.edgeData.port" (ngModelChange)="updateEdge(row.edge, 'port', +$event)" />
                </div>
                <div class="field">
                  <label>Protocolo</label>
                  <select [ngModel]="row.edgeData.protocol" (ngModelChange)="updateEdge(row.edge, 'protocol', $event)">
                    <option value="http">HTTP</option>
                    <option value="grpc">gRPC</option>
                  </select>
                </div>
                <div class="field">
                  <label>Traffic Ratio</label>
                  <input type="number" min="0" step="0.1" [ngModel]="row.edgeData.traffic_forward_ratio" (ngModelChange)="updateEdge(row.edge, 'traffic_forward_ratio', +$event)" />
                </div>
                <div class="field">
                  <label>Req Payload</label>
                  <input type="number" min="0" [ngModel]="row.edgeData.request_payload_size" (ngModelChange)="updateEdge(row.edge, 'request_payload_size', +$event)" />
                </div>
              </div>
              <!-- Activation flags — only show if pattern is configured -->
              <div class="activation-flags" *ngIf="ep.resilience_patterns?.timeout || ep.resilience_patterns?.retry || ep.resilience_patterns?.fallback">
                <label class="flag-toggle" *ngIf="ep.resilience_patterns?.timeout">
                  <input type="checkbox" [ngModel]="row.edgeData.active_timeout" (ngModelChange)="updateEdge(row.edge, 'active_timeout', $event)" />
                  <span class="to-label">Activar Timeout</span>
                </label>
                <label class="flag-toggle" *ngIf="ep.resilience_patterns?.retry">
                  <input type="checkbox" [ngModel]="row.edgeData.active_retry" (ngModelChange)="updateEdge(row.edge, 'active_retry', $event)" />
                  <span class="rt-label">Activar Retry</span>
                </label>
                <label class="flag-toggle" *ngIf="ep.resilience_patterns?.fallback">
                  <input type="checkbox" [ngModel]="row.edgeData.active_fallback" (ngModelChange)="updateEdge(row.edge, 'active_fallback', $event)" />
                  <span class="fb-label">Activar Fallback</span>
                </label>
              </div>
            </div>
          </ng-container>

          <!-- Resilience Patterns -->
          <div class="subsection-title">Resilience Patterns</div>

          <!-- TIMEOUT -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_patterns?.timeout" (change)="togglePattern(ep, 'timeout', $event)" />
              <span class="to-label">Timeout</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_patterns?.timeout">
              <div class="field">
                <label>Duration (ms)</label>
                <input type="number" min="0" [(ngModel)]="ep.resilience_patterns!.timeout!.duration_ms" (ngModelChange)="emit()" />
              </div>
            </div>
          </div>

          <!-- RETRY -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_patterns?.retry" (change)="togglePattern(ep, 'retry', $event)" />
              <span class="rt-label">Retry</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_patterns?.retry">
              <div class="field-row">
                <div class="field">
                  <label>Max Attempts</label>
                  <input type="number" min="1" [(ngModel)]="ep.resilience_patterns!.retry!.max_attempts" (ngModelChange)="emit()" />
                </div>
                <div class="field">
                  <label>Backoff (ms)</label>
                  <input type="number" min="0" [(ngModel)]="ep.resilience_patterns!.retry!.backoff_ms" (ngModelChange)="emit()" />
                </div>
                <div class="field">
                  <label>Multiplicador</label>
                  <input type="number" step="0.1" min="1" [(ngModel)]="ep.resilience_patterns!.retry!.backoff_multiplier" (ngModelChange)="emit()" />
                </div>
              </div>
            </div>
          </div>

          <!-- FALLBACK -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_patterns?.fallback" (change)="togglePattern(ep, 'fallback', $event)" />
              <span class="fb-label">Fallback</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_patterns?.fallback">
              <div class="field">
                <label>Respuesta por defecto</label>
                <input type="text" [(ngModel)]="ep.resilience_patterns!.fallback!.fallback_response" (ngModelChange)="emit()" placeholder="default-response" />
              </div>
              <div class="field">
                <label>Tasa de error que activa (0.0 – 1.0)</label>
                <input type="number" step="0.05" min="0" max="1" [(ngModel)]="ep.resilience_patterns!.fallback!.trigger_on_error_rate" (ngModelChange)="emit()" />
              </div>
            </div>
          </div>

        </div><!-- end ep-body -->
      </div><!-- end endpoint-item -->

      <button class="btn-add-ep" (click)="addEndpoint()">+ Agregar Endpoint</button>
    </div>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;

    .endpoints-tab { display: flex; flex-direction: column; gap: 8px; }

    .endpoint-item {
      border: 1px solid $border-color;
      border-radius: 8px;
      overflow: hidden;
    }

    .ep-header {
      display: flex; align-items: center; gap: 8px; padding: 10px 12px;
      background: $bg-surface; cursor: pointer; user-select: none;
      transition: background 0.15s;
      &:hover { background: rgba(255,255,255,0.05); }
      .ep-arrow { font-size: 10px; color: $text-secondary; }
      .ep-name  { flex: 1; font-size: 12px; font-weight: 600; color: $text-primary; font-family: monospace; }
      .ep-badges { display: flex; gap: 4px; }
    }

    .badge {
      padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 700;
      &.to { background: #1a3340; color: #7dd3fc; border: 1px solid #3c5e6e; }
      &.rt { background: #2a3318; color: #bef264; border: 1px solid #4e5e3c; }
      &.fb { background: #3a2e18; color: #fcd34d; border: 1px solid #6e5a3c; }
    }

    .btn-remove-ep {
      background: transparent; border: 1px solid $danger; color: $danger;
      padding: 2px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.15s;
      &:hover:not(:disabled) { background: $danger; color: white; }
      &:disabled { opacity: 0.3; cursor: not-allowed; }
    }

    .ep-body {
      padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
      background: #0f0f0f;
    }

    .subsection-title {
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em;
      color: $accent-blue; padding-top: 6px; margin-top: 2px;
      .subtitle-note { text-transform: none; color: $text-secondary; font-weight: 400; letter-spacing: 0; font-size: 10px; }
    }

    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      &.compact { grid-template-columns: repeat(4, 1fr); }
    }
    .field { display: flex; flex-direction: column; gap: 4px;
      label { font-size: 10px; color: $text-secondary; }
      input, select { width: 100%; font-size: 12px; padding: 5px 8px; }
    }

    .empty-edges { font-size: 11px; color: $text-secondary; padding: 6px 0; }

    .edge-row {
      background: $bg-surface; border: 1px solid $border-color; border-radius: 6px;
      padding: 10px; display: flex; flex-direction: column; gap: 8px;
    }
    .edge-target {
      display: flex; align-items: center; gap: 6px; font-size: 12px;
      strong { color: $text-primary; }
      .tag { font-size: 10px; color: $text-secondary; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; }
    }

    .activation-flags {
      display: flex; gap: 14px; padding-top: 4px; border-top: 1px solid $border-color;
    }
    .flag-toggle {
      display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px;
      input { width: auto; accent-color: $accent-blue; }
      .to-label { color: #7dd3fc; }
      .rt-label { color: #bef264; }
      .fb-label { color: #fcd34d; }
    }

    .pattern-block {
      border: 1px solid $border-color; border-radius: 6px; overflow: hidden;
    }
    .pattern-toggle {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: $bg-surface; cursor: pointer; font-size: 12px; font-weight: 500;
      input { width: auto; accent-color: $accent-blue; }
      .to-label { color: #7dd3fc; }
      .rt-label { color: #bef264; }
      .fb-label { color: #fcd34d; }
    }
    .pattern-fields {
      padding: 10px; background: #0d0d0d;
      display: flex; flex-direction: column; gap: 8px;
    }

    .btn-add-ep {
      background: transparent; border: 1px dashed $border-color; color: $text-secondary;
      padding: 8px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s;
      &:hover { border-color: $accent-blue; color: $accent-blue; }
    }
  `]
})
export class EndpointsTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Input() nodeId: string = '';
  @Output() dataChange = new EventEmitter<any>();

  endpoints: any[] = [];
  expandedIdx: number | null = 0;

  constructor(private graphService: GraphService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      this.endpoints = JSON.parse(JSON.stringify(this.nodeData.endpoints || []));
      if (this.expandedIdx !== null && this.expandedIdx >= this.endpoints.length) {
        this.expandedIdx = this.endpoints.length > 0 ? 0 : null;
      }
    }
  }

  toggleExpand(i: number) {
    this.expandedIdx = this.expandedIdx === i ? null : i;
  }

  addEndpoint() {
    const n = this.endpoints.length + 1;
    this.endpoints = [...this.endpoints, {
      name: `end${n}`,
      execution_mode: 'sequential',
      cpu_complexity: { execution_time: 0.001, threads: 1 },
      network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
    }];
    this.expandedIdx = this.endpoints.length - 1;
    this.emit();
  }

  removeEndpoint(i: number, event: Event) {
    event.stopPropagation();
    if (this.endpoints.length <= 1) return;
    this.endpoints = this.endpoints.filter((_, idx) => idx !== i);
    if (this.expandedIdx !== null && this.expandedIdx >= this.endpoints.length) {
      this.expandedIdx = this.endpoints.length - 1;
    }
    this.emit();
  }

  togglePattern(ep: any, pattern: 'timeout' | 'retry' | 'fallback', event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (!ep.resilience_patterns) ep.resilience_patterns = {};
    if (checked) {
      if (pattern === 'timeout')  ep.resilience_patterns.timeout  = { duration_ms: 5000 };
      if (pattern === 'retry')    ep.resilience_patterns.retry    = { max_attempts: 3, backoff_ms: 100, backoff_multiplier: 2.0 };
      if (pattern === 'fallback') ep.resilience_patterns.fallback = { fallback_response: 'default-response', trigger_on_error_rate: 0.5 };
    } else {
      delete ep.resilience_patterns[pattern];
      if (Object.keys(ep.resilience_patterns).length === 0) delete ep.resilience_patterns;
    }
    this.emit();
  }

  getEdgesForEndpoint(endpointName: string): Array<{ edge: Edge; edgeData: any; targetName: string; targetEndpoint: string }> {
    const graph = this.graphService.getGraph();
    if (!graph || !this.nodeId) return [];
    return graph.getEdges()
      .filter(edge => {
        const srcId  = edge.getSourceCellId();
        const srcEp  = (edge.getData() || {} as any).sourceEndpoint;
        const isFirst = this.endpoints.length > 0 && this.endpoints[0]?.name === endpointName;
        return srcId === this.nodeId && (srcEp === endpointName || (!srcEp && isFirst));
      })
      .map(edge => {
        const ed      = (edge.getData() || {}) as any;
        const tgtCell = graph.getCellById(edge.getTargetCellId() as string);
        const tgtData = (tgtCell?.isNode() ? (tgtCell as any).getData() : {}) || {};
        return {
          edge,
          edgeData:      { ...ed },
          targetName:    tgtData.name || 'unknown',
          targetEndpoint:ed.targetEndpoint || tgtData.endpoints?.[0]?.name || 'end1'
        };
      });
  }

  updateEdge(edge: Edge, field: string, value: any) {
    const current = edge.getData() || {};
    edge.setData({ ...current, [field]: value });
  }

  emit() {
    this.dataChange.emit({ ...this.nodeData, endpoints: JSON.parse(JSON.stringify(this.endpoints)) });
  }
}
