import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Node, Edge } from '@antv/x6';

import { GraphService } from '../../../core/services/graph.service';
import { GlobalSettings, ClusterLatency } from '../../../core/models/hydragen.model';

import { GeneralTabComponent }    from '../tabs/general-tab/general-tab.component';
import { ResourcesTabComponent }  from '../tabs/resources-tab/resources-tab.component';
import { ClustersTabComponent }   from '../tabs/clusters-tab/clusters-tab.component';
import { EndpointsTabComponent }  from '../tabs/endpoints-tab/endpoints-tab.component';
import { ResilienceTabComponent } from '../tabs/resilience-tab/resilience-tab.component';

type PanelMode = 'node' | 'edge' | 'global';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    GeneralTabComponent, ResourcesTabComponent,
    ClustersTabComponent, EndpointsTabComponent,
    ResilienceTabComponent
  ],
  template: `
    <!-- ═══════════════════════════════════════ NODE PANEL ════════════════ -->
    <ng-container *ngIf="mode === 'node'">
      <div class="panel-container">
        <div class="header">
          <div class="header-left">
            <span class="header-icon">◉</span>
            <div>
              <div class="header-title">{{ pendingData?.name || 'Service' }}</div>
              <div class="header-sub">Service Properties</div>
            </div>
          </div>
          <span class="node-id">{{ selectedNode!.id.substring(0,8) }}</span>
        </div>

        <div class="tabs">
          <button [class.active]="activeTab==='general'"    (click)="activeTab='general'">General</button>
          <button [class.active]="activeTab==='resources'"  (click)="activeTab='resources'">Resources</button>
          <button [class.active]="activeTab==='endpoints'"  (click)="activeTab='endpoints'">Endpoints</button>
          <button [class.active]="activeTab==='resilience'" (click)="activeTab='resilience'">Resilience</button>
        </div>

        <div class="tab-content">
          <app-general-tab    *ngIf="activeTab==='general'"    [nodeData]="pendingData" [availableClusters]="settings.clusters" (dataChange)="pendingData=$event" (goToGlobalSettings)="setMode('global')" ></app-general-tab>
          <app-resources-tab  *ngIf="activeTab==='resources'"  [nodeData]="pendingData" (dataChange)="pendingData=$event"></app-resources-tab>
          <app-endpoints-tab  *ngIf="activeTab==='endpoints'"  [nodeData]="pendingData" [nodeId]="selectedNode!.id" (dataChange)="pendingData=$event"></app-endpoints-tab>
          <app-resilience-tab *ngIf="activeTab==='resilience'" [nodeData]="pendingData" (goToEndpoints)="activeTab='endpoints'"></app-resilience-tab>
        </div>

        <div class="footer">
          <button class="btn-apply" (click)="applyNodeData()">✓ Aplicar</button>
        </div>
      </div>
    </ng-container>

    <!-- ═══════════════════════════════════════ EDGE PANEL ════════════════ -->
    <ng-container *ngIf="mode === 'edge'">
      <div class="panel-container">
        <div class="header">
          <div class="header-left">
            <span class="header-icon edge-icon">→</span>
            <div>
              <div class="header-title">Conexión</div>
              <div class="header-sub">Edge Properties</div>
            </div>
          </div>
          <span class="node-id">{{ selectedEdge!.id.substring(0,8) }}</span>
        </div>

        <div class="tab-content edge-content" *ngIf="edgeData">
          <!-- Source endpoint selector -->
          <div class="field">
            <label>Endpoint fuente (del nodo origen)</label>
            <select [(ngModel)]="edgeData.sourceEndpoint" (ngModelChange)="applyEdgeData()">
              <option *ngFor="let ep of sourceEndpoints" [value]="ep">{{ ep }}</option>
            </select>
          </div>
          <div class="field">
            <label>Endpoint destino</label>
            <input type="text" [(ngModel)]="edgeData.targetEndpoint" (ngModelChange)="applyEdgeData()" placeholder="end1" />
          </div>
          <div class="field-row">
            <div class="field">
              <label>Puerto</label>
              <input type="number" [(ngModel)]="edgeData.port" (ngModelChange)="applyEdgeData()" />
            </div>
            <div class="field">
              <label>Protocolo</label>
              <select [(ngModel)]="edgeData.protocol" (ngModelChange)="applyEdgeData()">
                <option value="http">HTTP</option>
                <option value="grpc">gRPC</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Traffic Forward Ratio</label>
              <input type="number" min="0" step="0.1" [(ngModel)]="edgeData.traffic_forward_ratio" (ngModelChange)="applyEdgeData()" />
            </div>
            <div class="field">
              <label>Request Payload (chars)</label>
              <input type="number" min="0" [(ngModel)]="edgeData.request_payload_size" (ngModelChange)="applyEdgeData()" />
            </div>
          </div>

          <div class="divider"></div>
          <div class="section-label">Activación de patrones</div>
          <p class="hint-small">Solo disponibles si el endpoint fuente tiene el patrón configurado.</p>

          <label class="flag-row" [class.disabled]="!sourceEndpointHasTimeout()">
            <input type="checkbox" [(ngModel)]="edgeData.active_timeout" (ngModelChange)="applyEdgeData()" [disabled]="!sourceEndpointHasTimeout()" />
            <span class="to-lbl">Activar Timeout</span>
          </label>
          <label class="flag-row" [class.disabled]="!sourceEndpointHasRetry()">
            <input type="checkbox" [(ngModel)]="edgeData.active_retry" (ngModelChange)="applyEdgeData()" [disabled]="!sourceEndpointHasRetry()" />
            <span class="rt-lbl">Activar Retry</span>
          </label>
          <label class="flag-row" [class.disabled]="!sourceEndpointHasFallback()">
            <input type="checkbox" [(ngModel)]="edgeData.active_fallback" (ngModelChange)="applyEdgeData()" [disabled]="!sourceEndpointHasFallback()" />
            <span class="fb-lbl">Activar Fallback</span>
          </label>
        </div>
      </div>
    </ng-container>

    <!-- ═══════════════════════════════════════ GLOBAL PANEL ═════════════ -->
    <ng-container *ngIf="mode === 'global'">
      <div class="panel-container">
        <div class="header">
          <div class="header-left">
            <span class="header-icon">⚙</span>
            <div>
              <div class="header-title">Global Settings</div>
              <div class="header-sub">Configuración de HydraGen</div>
            </div>
          </div>
        </div>

        <div class="tab-content">
          <div class="empty-hint" *ngIf="!settings">Cargando…</div>
          <ng-container *ngIf="settings">
            <div class="section-label">Ajustes globales</div>
            <div class="field">
              <label>Base Image</label>
              <input type="text" [(ngModel)]="settings.base_image" placeholder="ubuntu:20.04" />
            </div>

            <div class="divider"></div>
            <div class="section-label">Clusters Globales</div>
            <p class="hint-small">Define los clusters y asocia servicios a ellos.</p>
            
            <div class="latency-item" *ngFor="let cls of settings.clusters || []; let i = index">
              <div class="field-row">
                <div class="field">
                  <label>Nombre del Cluster</label>
                  <input type="text" [(ngModel)]="cls.name" placeholder="cluster1" />
                </div>
                <div class="field">
                  <label>Namespace</label>
                  <input type="text" [(ngModel)]="cls.namespace" placeholder="default" />
                </div>
              </div>
              <button class="btn-remove-sm" (click)="removeGlobalCluster(i)">Eliminar Cluster</button>
            </div>
            <button class="btn-add-sm" (click)="addGlobalCluster()">+ Agregar Cluster Global</button>

            <div class="divider"></div>
            <div class="section-label">Cluster Latencies</div>
            <div class="latency-item" *ngFor="let lat of clusterLatencies; let i = index; trackBy: trackByIndex">
              <div class="field-row">
                <div class="field">
                  <label>Origen</label>
                  <input type="text" [(ngModel)]="lat.src" />
                </div>
                <div class="field">
                  <label>Destino</label>
                  <input type="text" [(ngModel)]="lat.dest" />
                </div>
                <div class="field">
                  <label>Latencia (s)</label>
                  <input type="number" step="0.001" [(ngModel)]="lat.latency" />
                </div>
              </div>
              <button class="btn-remove-sm" (click)="removeLatency(i)">✕</button>
            </div>
            <button class="btn-add-sm" (click)="addLatency()">+ Agregar Latencia</button>

            <div class="empty-hint" style="margin-top:24px; text-align:center; font-size:11px;">
              Arrastra un <strong>Service</strong> al canvas para comenzar
            </div>
          </ng-container>
        </div>

        <div class="footer" *ngIf="settings">
          <button class="btn-apply" (click)="saveSettings()">✓ Aplicar Cambios Globales</button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    :host {
      display: block;
      height: 100%;
      background: $bg-card;
      border-left: 1px solid $border-color;
      overflow: hidden;
    }

    .panel-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .header {
      padding: 14px 16px;
      border-bottom: 1px solid $border-color;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-icon {
      font-size: 18px;
      color: $accent-blue;
      &.edge-icon { color: var(--text-secondary); }
    }
    .header-title  { font-size: 14px; font-weight: 600; color: $text-primary; }
    .header-sub    { font-size: 10px; color: $text-secondary; }
    .node-id       { font-size: 10px; color: $text-secondary; font-family: monospace; }

    /* ── Tabs ── */
    .tabs {
      display: flex;
      border-bottom: 1px solid $border-color;
      flex-shrink: 0;
      button {
        flex: 1;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: $text-secondary;
        padding: 9px 4px;
        font-size: 11px;
        border-radius: 0;
        cursor: pointer;
        transition: all 0.15s;
        &.active { color: $accent-blue; border-bottom-color: $accent-blue; }
        &:hover:not(.active) { color: $text-primary; }
      }
    }

    /* ── Tab content ── */
    .tab-content {
      padding: 16px;
      flex: 1;
      overflow-y: auto;
      &.edge-content { display: flex; flex-direction: column; gap: 12px; }
    }

    /* ── Footer ── */
    .footer {
      padding: 12px 16px;
      border-top: 1px solid $border-color;
      flex-shrink: 0;
    }
    .btn-apply {
      width: 100%;
      background: $accent-blue;
      color: white;
      border: none;
      padding: 9px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      &:hover { background: $accent-hover; }
    }

    /* ── Shared field styles ── */
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      label { font-size: 11px; color: $text-secondary; }
      input, select { width: 100%; font-size: 12px; }
    }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: $accent-blue;
      margin-bottom: 8px;
    }

    .divider {
      height: 1px;
      background: $border-color;
      margin: 8px 0;
    }

    .flag-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: $text-primary;
      cursor: pointer;
      padding: 4px 0;
      input { width: auto; accent-color: $accent-blue; }
      .to-lbl { color: var(--to-color); }
      .rt-lbl { color: var(--rt-color); }
      .fb-lbl { color: var(--fb-color); }
      &.disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .hint-small { font-size: 10px; color: $text-secondary; }

    /* ── Global panel ── */
    .latency-item {
      background: $bg-surface;
      border: 1px solid $border-color;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .btn-remove-sm {
      align-self: flex-end;
      background: transparent;
      border: 1px solid $danger;
      color: $danger;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      &:hover { background: $danger; color: white; }
    }
    .btn-add-sm {
      background: transparent;
      border: 1px dashed $border-color;
      color: $text-secondary;
      padding: 7px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      width: 100%;
      &:hover { border-color: $accent-blue; color: $accent-blue; }
    }
    .services-assoc { margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; }
    .assoc-label { font-size: 10px; color: $text-secondary; margin-bottom: 6px; display: block; font-weight: 600; }
    .assoc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .assoc-check {
      display: flex; align-items: center; gap: 6px; font-size: 11px; color: $text-primary; cursor: pointer;
      input { width: auto; accent-color: $accent-blue; }
    }

    .empty-hint {
      color: $text-secondary;
      font-size: 12px;
      padding: 8px 0;
      strong { color: $accent-blue; }
    }
  `]
})
export class PropertiesPanelComponent implements OnInit, OnDestroy {
  mode: PanelMode = 'global';
  activeTab = 'general';

  // Node
  selectedNode: Node | null = null;
  pendingData: any = {};

  // Edge
  selectedEdge: Edge | null = null;
  edgeData: any = {};
  sourceEndpoints: string[] = [];

  // Global
  settings: GlobalSettings = { logging: true, development: true, base_image: '', clusters: [] };
  clusterLatencies: ClusterLatency[] = [];

  private subs = new Subscription();

  constructor(
    private graphService: GraphService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.settings = this.graphService.getSettings();
    if (!this.settings.clusters) this.settings.clusters = [];
    this.clusterLatencies = [...this.graphService.getClusterLatencies()];

    this.subs.add(this.graphService.nodeSelected$.subscribe(node => {
      this.selectedEdge = null;
      this.selectedNode = node;
      if (node) {
        this.mode = 'node';
        this.pendingData = JSON.parse(JSON.stringify(node.getData() || {}));
        this.activeTab = 'general';
      } else {
        this.mode = 'global';
        this.settings = this.graphService.getSettings();
        if (!this.settings.clusters) this.settings.clusters = [];
        this.clusterLatencies = [...this.graphService.getClusterLatencies()];
      }
      this.cdr.detectChanges();
    }));

    this.subs.add(this.graphService.edgeSelected$.subscribe(edge => {
      this.selectedNode = null;
      this.selectedEdge = edge;
      if (edge) {
        this.mode = 'edge';
        this.edgeData = { ...(edge.getData() ?? {}) };
        this.loadSourceEndpoints(edge);
      } else {
        this.mode = 'global';
        this.settings = this.graphService.getSettings();
        if (!this.settings.clusters) this.settings.clusters = [];
        this.clusterLatencies = [...this.graphService.getClusterLatencies()];
      }
      this.cdr.detectChanges();
    }));
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  setMode(mode: PanelMode) {
    this.mode = mode;
    this.activeTab = 'general';
    this.cdr.detectChanges();
  }

  /* ═══════════ Node ═══════════ */
  applyNodeData() {
    if (!this.selectedNode) return;
    console.log(this.pendingData)
    this.selectedNode.setData(this.pendingData, { overwrite: true });
    this.graphService.refreshNodeVisuals(this.selectedNode);
    this.graphService.notifyApply();
    this.cdr.detectChanges();
  }

  /* ═══════════ Edge ═══════════ */
  private loadSourceEndpoints(edge: Edge) {
    const graph = this.graphService.getGraph();
    if (!graph) return;
    const srcCell = graph.getCellById(edge.getSourceCellId() as string);
    const srcData = (srcCell && (srcCell as any).isNode()) ? (srcCell as any).getData() : {};
    this.sourceEndpoints = (srcData.endpoints || []).map((ep: any) => ep.name).filter(Boolean);
    if (this.sourceEndpoints.length > 0 && !this.edgeData.sourceEndpoint) {
      this.edgeData.sourceEndpoint = this.sourceEndpoints[0];
      this.applyEdgeData(); // Guardar selección automáticamente
    }
  }

  applyEdgeData() {
    if (!this.selectedEdge) return;
    this.selectedEdge.setData({ ...this.edgeData }, { overwrite: true });
  }

  sourceEndpointHasTimeout(): boolean {
    return this.getSourceEndpointData()?.resilience_patterns?.timeout != null;
  }
  sourceEndpointHasRetry(): boolean {
    return this.getSourceEndpointData()?.resilience_patterns?.retry != null;
  }
  sourceEndpointHasFallback(): boolean {
    return this.getSourceEndpointData()?.resilience_patterns?.fallback != null;
  }

  private getSourceEndpointData(): any {
    const graph = this.graphService.getGraph();
    if (!graph || !this.selectedEdge) return null;
    const srcCell = graph.getCellById(this.selectedEdge.getSourceCellId() as string);
    const srcData = (srcCell && (srcCell as any).isNode()) ? (srcCell as any).getData() : {};
    const epName  = this.edgeData.sourceEndpoint;
    return (srcData.endpoints || []).find((ep: any) => ep.name === epName) || null;
  }

  /* ═══════════ Global ═══════════ */
  saveSettings() {
    this.graphService.setSettings({ ...this.settings });
    this.graphService.notifyApply();
  }

  addGlobalCluster() {
    if (!this.settings.clusters) this.settings.clusters = [];
    this.settings.clusters.push({ name: 'cluster1', namespace: 'default'});
    this.saveSettings();
  }

  removeGlobalCluster(i: number) {
    if (this.settings.clusters) {
      this.settings.clusters.splice(i, 1);
      this.saveSettings();
    }
  }

  toggleServiceInCluster(cluster: any, sName: string) {
    if (!cluster.services) cluster.services = [];
    const idx = cluster.services.indexOf(sName);
    if (idx >= 0) cluster.services.splice(idx, 1);
    else cluster.services.push(sName);
    this.saveSettings();
  }

  getAllServiceNames(): string[] {
    const g = this.graphService.getGraph();
    if (!g) return [];
    return g.getNodes().map(n => (n.getData() || {}).name).filter(Boolean);
  }

  saveLatencies() {
    this.graphService.setClusterLatencies([...this.clusterLatencies]);
    this.graphService.notifyApply();
  }

  addLatency() {
    this.clusterLatencies = [...this.clusterLatencies, { src: '', dest: '', latency: 0 }];
    this.saveLatencies();
  }

  removeLatency(i: number) {
    this.clusterLatencies = this.clusterLatencies.filter((_, idx) => idx !== i);
    this.saveLatencies();
  }

  trackByIndex(index: number) {
    return index;
  }
}
