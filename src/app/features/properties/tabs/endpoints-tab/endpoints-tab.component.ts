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

      <div class="endpoint-item" *ngFor="let ep of endpoints; let ei = index; trackBy: trackByEp">
        <!-- Accordion Header -->
        <div class="ep-header" (click)="toggleExpand(ei)">
          <span class="ep-arrow">{{ expandedIdx === ei ? 'V' : '>' }}</span>
          <span class="ep-name">{{ ep.name || 'endpoint' }}</span>
          <div class="ep-badges">
            <span class="badge to" *ngIf="ep.resilience_parameters?.timeout">TO</span>
            <span class="badge rt" *ngIf="ep.resilience_parameters?.retry">RT</span>
            <span class="badge fb" *ngIf="ep.resilience_parameters?.fallback">FB</span>
            <span class="badge cb" *ngIf="ep.resilience_parameters?.circuit_breaker">CB</span>
          </div>
          <button class="btn-remove-ep" (click)="removeEndpoint(ei, $event)" [disabled]="endpoints.length <= 1" title="Eliminar endpoint">X</button>
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
          <ng-container *ngIf="cachedEdges[ep.name] as edgeRows">
            <div class="empty-edges" *ngIf="edgeRows.length === 0">
              Sin conexiones salientes asignadas a este endpoint.
            </div>
            <div class="edge-row" *ngFor="let row of edgeRows; trackBy: trackByEdge">
              <div class="edge-target">
                <span class="tag">-></span>
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
                  <div class="readonly-value">{{ currentProtocol.toUpperCase() }}</div>
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

              <div class="field-row">
                <div class="field">
                  <label>Endpoint Origen</label>
                  <select [ngModel]="row.edgeData.sourceEndpoint || endpoints[0]?.name" (ngModelChange)="updateEdge(row.edge, 'sourceEndpoint', $event)">
                    <option *ngFor="let ep of endpoints" [value]="ep.name">{{ ep.name }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>Endpoint Destino</label>
                  <select [ngModel]="row.edgeData.targetEndpoint" (ngModelChange)="updateEdge(row.edge, 'targetEndpoint', $event)">
                    <option [value]="undefined" disabled>Seleccionar endpoint...</option>
                    <option *ngFor="let epName of getAvailableEndpoints(row.targetName)" [value]="epName">{{ epName }}</option>
                  </select>
                </div>
              </div>
              <!-- Activation flags — only show if pattern is configured -->
              <div class="activation-flags" *ngIf="ep.resilience_parameters?.circuit_breaker">
                <label class="flag-toggle">
                  <input type="checkbox" [ngModel]="row.edgeData.active_circuit_breaker" (ngModelChange)="updateEdge(row.edge, 'active_circuit_breaker', $event)" />
                  <span class="cb-label">Activar Circuit Breaker</span>
                </label>
              </div>
            </div>
          </ng-container>

          <!-- Resilience Patterns -->
          <div class="subsection-title">Resilience Patterns <span class="pattern-warn-icon" data-tooltip="Timeout, Retry y Circuit Breaker no se pueden usar juntos. Solo uno puede estar activo a la vez. Fallback es compatible con todos.">⚠</span></div>

          <!-- TIMEOUT -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_parameters?.timeout" (change)="togglePattern(ep, 'timeout', $event)" />
              <span class="to-label">Timeout</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_parameters?.timeout">
              <div class="field">
                <label>Duration (s)</label>
                <input type="number" min="0" [(ngModel)]="ep.resilience_parameters!.timeout!.duration_s" (ngModelChange)="emit()" />
              </div>
            </div>
          </div>

          <!-- RETRY -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_parameters?.retry" (change)="togglePattern(ep, 'retry', $event)" />
              <span class="rt-label">Retry</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_parameters?.retry">
              <div class="field-row">
                <div class="field">
                  <label>Max Attempts</label>
                  <input type="number" min="1" [(ngModel)]="ep.resilience_parameters!.retry!.max_attempts" (ngModelChange)="emit()" />
                </div>
                <div class="field">
                  <label>Backoff (ms)</label>
                  <input type="number" min="0" [(ngModel)]="ep.resilience_parameters!.retry!.backoff_ms" (ngModelChange)="emit()" />
                </div>
                <div class="field">
                  <label>Multiplicador</label>
                  <input type="number" step="0.1" min="1" [(ngModel)]="ep.resilience_parameters!.retry!.backoff_multiplier" (ngModelChange)="emit()" />
                </div>
                <div class="field">
                  <label>Max Backoff (ms)</label>
                  <input type="number" min="0" [(ngModel)]="ep.resilience_parameters!.retry!.max_backoff_ms" (ngModelChange)="emit()" />
                </div>
              </div>
            </div>
          </div>

          <!-- FALLBACK -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_parameters?.fallback" (change)="togglePattern(ep, 'fallback', $event)" />
              <span class="fb-label">Fallback</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_parameters?.fallback">
              <div class="field">
                <label>Tipo de Fallback</label>
                <select [(ngModel)]="ep.resilience_parameters!.fallback!.type" (ngModelChange)="emit()">
                  <option value="static">Static (Respuesta fija)</option>
                  <option value="service">Service (Redirigir a otro servicio)</option>
                </select>
              </div>

              <!-- STATIC FIELDS -->
              <ng-container *ngIf="ep.resilience_parameters!.fallback!.type === 'static'">
                <div class="field-row">
                  <div class="field">
                    <label>Código de respuesta</label>
                    <input type="number" [(ngModel)]="ep.resilience_parameters!.fallback!.response_code" (ngModelChange)="emit()" />
                  </div>
                  <div class="field">
                    <label>Payload de respuesta</label>
                    <input type="text" [(ngModel)]="ep.resilience_parameters!.fallback!.response_payload" (ngModelChange)="emit()" placeholder="fallback-response" />
                  </div>
                </div>
              </ng-container>

              <!-- SERVICE FIELDS -->
              <ng-container *ngIf="ep.resilience_parameters!.fallback!.type === 'service'">
                <div class="field-row">
                  <div class="field">
                    <label>Servicio Destino</label>
                    <select [(ngModel)]="ep.resilience_parameters!.fallback!.service" (ngModelChange)="onFallbackServiceChange(ep)">
                      <option [value]="undefined" disabled>Seleccionar servicio...</option>
                      <option *ngFor="let s of getUniqueTargetServices(ep.name)" [value]="s">{{ s }}</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Endpoint</label>
                    <select [(ngModel)]="ep.resilience_parameters!.fallback!.endpoint" (ngModelChange)="onFallbackEndpointChange(ep)" [disabled]="!ep.resilience_parameters!.fallback!.service">
                      <option [value]="undefined" disabled>Seleccionar endpoint...</option>
                      <option *ngFor="let e of getEndpointsForTarget(ep.name, ep.resilience_parameters!.fallback!.service!)" [value]="e">{{ e }}</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Puerto</label>
                    <select [(ngModel)]="ep.resilience_parameters!.fallback!.port" (ngModelChange)="emit()" [disabled]="!ep.resilience_parameters!.fallback!.endpoint">
                      <option [value]="undefined" disabled>Seleccionar puerto...</option>
                      <option *ngFor="let p of getPortsForTarget(ep.name, ep.resilience_parameters!.fallback!.service!, ep.resilience_parameters!.fallback!.endpoint!)" [value]="p">{{ p }}</option>
                    </select>
                  </div>
                </div>
              </ng-container>
            </div>
          </div>

          <!-- CIRCUIT BREAKER -->
          <div class="pattern-block">
            <label class="pattern-toggle">
              <input type="checkbox" [checked]="!!ep.resilience_parameters?.circuit_breaker" (change)="togglePattern(ep, 'circuit_breaker', $event)" />
              <span class="cb-label">Circuit Breaker</span>
            </label>
            <div class="pattern-fields" *ngIf="ep.resilience_parameters?.circuit_breaker">
              <div class="field-row">
                <div class="field">
                  <label>Timeout (s)</label>
                  <input type="number" min="0" [(ngModel)]="ep.resilience_parameters!.circuit_breaker!.timeout" (ngModelChange)="emit()" />
                </div>
                <div class="field">
                  <label>Retry Timer (s)</label>
                  <input type="number" min="0" [(ngModel)]="ep.resilience_parameters!.circuit_breaker!.retry_timer" (ngModelChange)="emit()" />
                </div>
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
      &.to { background: var(--bg-accent-subtle); color: var(--to-color); border: 1px solid var(--to-color); }
      &.rt { background: var(--bg-success-subtle); color: var(--rt-color); border: 1px solid var(--rt-color); }
      &.fb { background: var(--bg-warning-subtle); color: var(--fb-color); border: 1px solid var(--fb-color); }
      &.cb { background: rgba(156, 39, 176, 0.1); color: #ce93d8; border: 1px solid #ce93d8; }
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
      background: var(--bg-primary);
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
    .readonly-value {
      width: 100%;
      min-height: 28px;
      padding: 6px 8px;
      border: 1px solid $border-color;
      border-radius: 4px;
      background: rgba(255,255,255,0.03);
      color: $text-secondary;
      font-size: 12px;
      font-family: monospace;
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
      .to-label { color: var(--to-color); }
      .rt-label { color: var(--rt-color); }
      .fb-label { color: var(--fb-color); }
      .cb-label { color: #ce93d8; }
    }

    .pattern-block {
      border: 1px solid $border-color; border-radius: 6px; overflow: hidden;
    }
    .pattern-toggle {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: $bg-surface; cursor: pointer; font-size: 12px; font-weight: 500;
      input { width: auto; accent-color: $accent-blue; }
      .to-label { color: var(--to-color); }
      .rt-label { color: var(--rt-color); }
      .fb-label { color: var(--fb-color); }
      .cb-label { color: #ce93d8; }
    }
    .pattern-fields {
      padding: 10px; background: var(--bg-primary);
      display: flex; flex-direction: column; gap: 8px;
    }

    .pattern-warn-icon {
      display: inline-block;
      font-size: 12px;
      color: var(--warning);
      opacity: 0.6;
      cursor: default;
      position: relative;
      margin-left: 4px;
      vertical-align: text-top;
      top: -3px;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1;
      }

      /* Tooltip arrow */
      &::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: var(--bg-surface);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      /* Tooltip body */
      &::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%) translateY(4px);
        width: max-content;
        max-width: 220px;
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        font-size: 11px;
        font-weight: 400;
        font-family: 'Inter', sans-serif;
        line-height: 1.5;
        letter-spacing: 0;
        text-transform: none;
        white-space: normal;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 50;
      }

      &:hover::before {
        opacity: 1;
      }

      &:hover::after {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .btn-add-ep {
      background: transparent; border: 1px dashed $border-color; color: $text-secondary;
      padding: 8px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s;
      &:hover { border-color: $accent-blue; color: $accent-blue; }
    }
    .hint-error { font-size: 10px; color: $danger; margin-top: 4px; }
  `]
})
export class EndpointsTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Input() nodeId: string = '';
  @Input() graphRevision = 0;
  @Output() dataChange = new EventEmitter<any>();

  endpoints: any[] = [];
  cachedEdges: { [key: string]: any[] } = {};
  expandedIdx: number | null = 0;

  constructor(private graphService: GraphService) { }

  get currentProtocol(): 'http' | 'grpc' {
    return this.nodeData.protocol || 'http';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      const newEndpoints = this.nodeData.endpoints || [];
      // Solo actualizar si la longitud cambió o si los datos son realmente distintos.
      // Esto evita que al escribir (que dispara un emit -> ngOnChanges) se sobrescriba el array local
      // y se pierda el foco del input.
      if (this.endpoints.length !== newEndpoints.length || JSON.stringify(this.endpoints) !== JSON.stringify(newEndpoints)) {
        this.endpoints = JSON.parse(JSON.stringify(newEndpoints));
        this.refreshAllEdges();
      }

      if (this.expandedIdx !== null && this.expandedIdx >= this.endpoints.length) {
        this.expandedIdx = this.endpoints.length > 0 ? 0 : null;
      }
    }
    if (changes['nodeId'] && this.nodeId) {
      this.refreshAllEdges();
    }
    if (changes['graphRevision'] && !changes['graphRevision'].firstChange) {
      this.refreshAllEdges();
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
    this.refreshAllEdges();
    this.emit();
  }

  removeEndpoint(i: number, event: Event) {
    event.stopPropagation();
    if (this.endpoints.length <= 1) return;
    this.endpoints = this.endpoints.filter((_, idx) => idx !== i);
    if (this.expandedIdx !== null && this.expandedIdx >= this.endpoints.length) {
      this.expandedIdx = this.endpoints.length - 1;
    }
    this.refreshAllEdges();
    this.emit();
  }

  togglePattern(ep: any, pattern: 'timeout' | 'retry' | 'fallback' | 'circuit_breaker', event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (!ep.resilience_parameters) ep.resilience_parameters = {};

    if (checked) {
      if (pattern === 'circuit_breaker') {
        // Circuit Breaker is exclusive with Timeout and Retry, but compatible with Fallback
        delete ep.resilience_parameters.timeout;
        delete ep.resilience_parameters.retry;
        ep.resilience_parameters.circuit_breaker = { timeout: 5, retry_timer: 10 };
      } else if (pattern === 'timeout') {
        // Timeout is exclusive with Retry and Circuit Breaker
        delete ep.resilience_parameters.retry;
        delete ep.resilience_parameters.circuit_breaker;
        ep.resilience_parameters.timeout = { duration_s: 5 };
      } else if (pattern === 'retry') {
        // Retry is exclusive with Timeout and Circuit Breaker
        delete ep.resilience_parameters.timeout;
        delete ep.resilience_parameters.circuit_breaker;
        ep.resilience_parameters.retry = { max_attempts: 3, backoff_ms: 100, backoff_multiplier: 2.0, max_backoff_ms: 5000 };
      } else if (pattern === 'fallback') {
        // Fallback is compatible with all other active patterns
        ep.resilience_parameters.fallback = { type: 'static', response_code: 200, response_payload: 'fallback-response' };
      }
    } else {
      delete ep.resilience_parameters[pattern];
      if (Object.keys(ep.resilience_parameters).length === 0) delete ep.resilience_parameters;
    }
    this.emit();
  }


  updateEdge(edge: Edge, field: string, value: any) {
    edge.prop(`data/${field}`, value);
    this.refreshAllEdges();
    this.emit();
  }

  getAvailableEndpoints(serviceName: string): string[] {
    const graph = this.graphService.getGraph();
    if (!graph) return [];
    const node = graph.getNodes().find(n => (n.getData() as any)?.name === serviceName);
    if (!node) return [];
    const data = node.getData() as any;
    return (data.endpoints || []).map((ep: any) => ep.name || 'endpoint');
  }

  // --- Fallback Helpers ---

  getUniqueTargetServices(epName: string): string[] {
    const graph = this.graphService.getGraph();
    if (!graph) return [];
    return graph.getNodes()
      .map(n => (n.getData() as any)?.name)
      .filter(name => name && name !== this.nodeData.name); // Evitar llamarse a si mismo
  }

  getEndpointsForTarget(epName: string, targetName: string): string[] {
    if (!targetName) return [];
    const graph = this.graphService.getGraph();
    if (!graph) return [];
    const node = graph.getNodes().find(n => (n.getData() as any)?.name === targetName);
    if (!node) return [];
    const data = node.getData() as any;
    return (data.endpoints || []).map((ep: any) => ep.name || 'endpoint');
  }

  getPortsForTarget(epName: string, targetName: string, targetEndpoint: string): number[] {
    if (!targetName || !targetEndpoint) return [];
    const graph = this.graphService.getGraph();
    if (!graph) return [80];
    
    // Buscar puertos usados en cualquier conexion hacia este target/endpoint
    const edges = graph.getEdges().filter(e => {
      const ed = e.getData() || {};
      const tgtNode = graph.getCellById(e.getTargetCellId() as string);
      const tgtData = (tgtNode?.isNode() ? (tgtNode as any).getData() : {}) || {};
      return tgtData.name === targetName && (ed.targetEndpoint === targetEndpoint || (!ed.targetEndpoint && targetEndpoint === 'end1'));
    });

    if (edges.length === 0) return [80, 443, 8080];
    return [...new Set(edges.map(e => (e.getData() as any).port || 80))];
  }

  onFallbackServiceChange(ep: any) {
    const fb = ep.resilience_parameters?.fallback;
    if (!fb) return;
    const endpoints = this.getEndpointsForTarget(ep.name, fb.service);
    fb.endpoint = endpoints.length > 0 ? endpoints[0] : undefined;
    this.onFallbackEndpointChange(ep);
  }

  onFallbackEndpointChange(ep: any) {
    const fb = ep.resilience_parameters?.fallback;
    if (!fb) return;
    const ports = this.getPortsForTarget(ep.name, fb.service, fb.endpoint);
    fb.port = ports.length > 0 ? ports[0] : undefined;
    this.emit();
  }

  emit() {
    this.dataChange.emit({ ...this.nodeData, endpoints: JSON.parse(JSON.stringify(this.endpoints)) });
  }

  refreshAllEdges() {
    this.cachedEdges = {};
    this.endpoints.forEach(ep => {
      this.cachedEdges[ep.name] = this.getEdgesForEndpointInternal(ep.name);
    });
  }

  private getEdgesForEndpointInternal(endpointName: string): Array<{ edge: Edge; edgeData: any; targetName: string; targetEndpoint: string }> {
    const graph = this.graphService.getGraph();
    if (!graph || !this.nodeId) return [];
    return graph.getEdges()
      .filter(edge => {
        const srcId = edge.getSourceCellId();
        const srcEp = (edge.getData() || {} as any).sourceEndpoint;
        const isFirst = this.endpoints.length > 0 && this.endpoints[0]?.name === endpointName;
        return srcId === this.nodeId && (srcEp === endpointName || (!srcEp && isFirst));
      })
      .map(edge => {
        const ed = (edge.getData() || {}) as any;
        const tgtCell = graph.getCellById(edge.getTargetCellId() as string);
        const tgtData = (tgtCell?.isNode() ? (tgtCell as any).getData() : {}) || {};
        return {
          edge,
          edgeData: { ...ed },
          targetName: tgtData.name || 'unknown',
          targetEndpoint: ed.targetEndpoint || tgtData.endpoints?.[0]?.name || 'end1'
        };
      });
  }

  trackByEp(index: number, item: any) { return index; }
  trackByEdge(index: number, item: any) { return item.edge.id; }
}
