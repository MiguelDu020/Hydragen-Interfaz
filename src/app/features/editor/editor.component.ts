import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Graph, Shape } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
import { Subscription } from 'rxjs';
import { GraphService } from '../../core/services/graph.service';

/** Trunca texto y añade '…' para que nunca desborde la caja en SVG. */
function trunc(text: string, maxChars: number): string {
  return text.length > maxChars ? text.substring(0, maxChars - 1) + '\u2026' : text;
}

const NODE_W = 260;
const NODE_H = 130;

// Registrar forma personalizada para los nodos de servicio
Graph.registerNode('service-node', {
  width: NODE_W,
  height: NODE_H,
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'line', selector: 'divider' },
    { tagName: 'text', selector: 'icon' },
    { tagName: 'text', selector: 'title' },
    { tagName: 'rect', selector: 'badgeBg' },
    { tagName: 'text', selector: 'badge' },
    { tagName: 'text', selector: 'resources' },
    { tagName: 'text', selector: 'cluster' },
    { tagName: 'text', selector: 'patternBadges' }
  ],
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: 'var(--node-bg)',
      stroke: 'var(--node-border)',
      strokeWidth: 1.2,
      rx: 10,
      ry: 10
    }
  }
}, true);

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="canvas-container" #canvasContainer (contextmenu)="$event.preventDefault()"></div>
    <div class="apply-toast" *ngIf="showApplyToast">
      Cambios aplicados correctamente
    </div>

    <div class="ctx-menu" *ngIf="ctxMenu.visible"
         [style.left.px]="ctxMenu.x"
         [style.top.px]="ctxMenu.y"
         (mouseleave)="closeCtxMenu()">
      <button (click)="ctxAction('delete')">Eliminar</button>
      <button (click)="ctxAction('copy')"  *ngIf="ctxMenu.type==='node'">Copiar</button>
      <button (click)="ctxAction('paste')" *ngIf="ctxMenu.type==='node'">Pegar</button>
      <button (click)="ctxAction('cut')"   *ngIf="ctxMenu.type==='node'">Cortar</button>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    .canvas-container { width: 100%; height: 100%; outline: none; }


    .apply-toast {
      position: absolute; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px; border-radius: 8px; font-size: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      animation: fadeInUp 0.2s ease; white-space: nowrap;
      background: #0f3d24; border: 1px solid #22c55e; color: #bbf7d0;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .ctx-menu {
      position: absolute; background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 6px; padding: 4px 0; z-index: 100;
      min-width: 140px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      button {
        display: block; width: 100%; background: transparent; border: none;
        color: var(--text-primary); padding: 8px 16px; text-align: left;
        font-size: 13px; cursor: pointer;
        &:hover { background: rgba(128,128,128,0.1); }
      }
    }
  `]
})
export class EditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  private graph!: Graph;

  showApplyToast = false;
  private applyToastTimer: any;
  private serviceCounter = 0;

  ctxMenu: { visible: boolean; x: number; y: number; type: 'node' | 'edge' | ''; cell: any } =
    { visible: false, x: 0, y: 0, type: '', cell: null };
  private copiedData: any = null;
  private applyConfirmedSub?: Subscription;

  constructor(private graphService: GraphService) { }

  ngAfterViewInit() { this.initGraph(); }

  ngOnDestroy() { this.applyConfirmedSub?.unsubscribe(); }

  private initGraph() {
    this.graph = new Graph({
      container: this.canvasContainer.nativeElement,
      background: { color: 'var(--graph-bg)' },
      grid: { visible: true, type: 'dot', args: { color: 'var(--graph-grid)', size: 20 } },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowMulti: 'withPort',
        connector: 'rounded',
        router: 'manhattan',          // ← autorouting restaurado
        createEdge: () => new Shape.Edge({
          attrs: { line: { stroke: 'var(--text-secondary)', strokeWidth: 2, targetMarker: { name: 'block', size: 12 } } },
          data: {
            sourceEndpoint: '', targetEndpoint: 'end1',
            port: 80, protocol: 'http',
            traffic_forward_ratio: 1, request_payload_size: 0,
            active_timeout: false, active_retry: false, active_fallback: false
          }
        })
      },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      panning: { enabled: true }
    });

    this.graphService.setGraph(this.graph);
    this.graph.use(new History({ enabled: true }));

    // Vértices manuales al hacer hover (sin redireccionar origen/destino)
    this.graph.on('edge:mouseenter', ({ edge }) => {
      edge.addTools([{ name: 'vertices', args: { attrs: { fill: '#007acc', r: 5 } } }]);
    });
    this.graph.on('edge:mouseleave', ({ edge }) => { edge.removeTools(); });

    // Menú contextual
    this.graph.on('node:contextmenu', ({ node, x, y, e }) => {
      e.preventDefault();
      const local = this.graph.localToClient(x, y);
      this.ctxMenu = { visible: true, x: local.x, y: local.y, type: 'node', cell: node };
    });
    this.graph.on('edge:contextmenu', ({ edge, x, y, e }) => {
      e.preventDefault();
      const local = this.graph.localToClient(x, y);
      this.ctxMenu = { visible: true, x: local.x, y: local.y, type: 'edge', cell: edge };
    });
    this.graph.on('blank:click', () => this.closeCtxMenu());

    this.applyConfirmedSub = this.graphService.applyConfirmed$.subscribe(() => {
      this.showApplyConfirmation();
    });
  }

  showApplyConfirmation() {
    this.showApplyToast = true;
    clearTimeout(this.applyToastTimer);
    this.applyToastTimer = setTimeout(() => { this.showApplyToast = false; }, 2500);
  }

  closeCtxMenu() { this.ctxMenu = { ...this.ctxMenu, visible: false }; }

  ctxAction(action: string) {
    const { cell, type } = this.ctxMenu;
    this.closeCtxMenu();
    if (!cell) return;
    if (action === 'delete') {
      this.graph.removeCell(cell);
    } else if (action === 'copy' && type === 'node') {
      this.copiedData = JSON.parse(JSON.stringify(cell.getData()));
    } else if (action === 'cut' && type === 'node') {
      this.copiedData = JSON.parse(JSON.stringify(cell.getData()));
      this.graph.removeCell(cell);
    } else if (action === 'paste' && this.copiedData) {
      const pos = cell.getPosition();
      this.createServiceNodeWithData(pos.x + 30, pos.y + 30, {
        ...this.copiedData, name: this.copiedData.name + '-copy'
      });
    }
  }

  @HostListener('dragover', ['$event']) onDragOver(e: DragEvent) { e.preventDefault(); }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const type = event.dataTransfer.getData('type');
    if (!type) return;
    const point = this.graph.clientToLocal({ x: event.clientX, y: event.clientY });
    if (type === 'service') this.createServiceNode(point.x, point.y);
  }



  private createServiceNode(x: number, y: number) {
    const name = `service-${++this.serviceCounter}`;
    this.createServiceNodeWithData(x, y, {
      rawType: 'service', name, protocol: 'http',
      clusters: [{ cluster: 'cluster1', replicas: 1, namespace: 'default' }],
      resources: { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
      processes: 1, readiness_probe: 2, logging: false, development: false, base_image: '',
      endpoints: [{
        name: 'end1', execution_mode: 'sequential',
        cpu_complexity: { execution_time: 0.001, threads: 1 },
        network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
      }]
    });
  }

  createServiceNodeWithData(x: number, y: number, data: any) {
    const name = data.name || `service-${++this.serviceCounter}`;

    const cpuReq = data.resources?.requests?.cpu || '500m';
    const cpuLim = data.resources?.limits?.cpu || '1000m';
    const memReq = data.resources?.requests?.memory || '256M';
    const memLim = data.resources?.limits?.memory || '1024M';
    const repl = data.clusters?.[0]?.replicas ?? 1;
    const clust = data.clusters?.[0]?.cluster || 'cluster1';
    const proto = (data.protocol || 'http').toUpperCase();

    // Texto truncado en JS — garantía de que nunca desborda la caja
    // Título: ~155px disponibles a fontSize 12 ≈ máx 20 chars
    const titleTxt = trunc(name, 20);
    // Body: ~232px disponibles a fontSize 10 monospace ≈ máx 36 chars
    const resourceTxt = trunc(`CPU ${cpuReq}/${cpuLim}  MEM ${memReq}/${memLim}`, 36);
    const clusterTxt = trunc(`Replicas ${repl}  Cluster ${clust}`, 34);

    this.graphService.addNode({
      x, y, width: NODE_W, height: NODE_H, shape: 'service-node', data,
      attrs: {
        divider: { x1: 0, y1: 42, x2: NODE_W, y2: 42, stroke: 'var(--node-divider)', strokeWidth: 1 },
        icon: { text: '\u25c9', fill: 'var(--text-muted)', fontSize: 14, x: 14, y: 26 },
        title:         { text: titleTxt, fill: 'var(--node-text)', fontSize: 13, fontWeight: 700, x: 34, y: 26 },
        badgeBg:       { fill: 'var(--node-badge-bg)', rx: 5, ry: 5, width: 44, height: 18, refX: '100%', refX2: -56, y: 11 },
        badge:         { text: proto, fill: 'var(--node-badge-text)', fontSize: 9, fontWeight: 600, refX: '100%', refX2: -52, y: 23 },
        resources:     { text: resourceTxt, fill: 'var(--node-text-muted)', fontSize: 11, x: 14, y: 68, fontFamily: 'monospace' },
        cluster:       { text: clusterTxt,  fill: 'var(--node-text-muted)', fontSize: 11, x: 14, y: 86, fontFamily: 'monospace' },
        patternBadges: { text: '', fill: 'var(--accent-blue)', fontSize: 10, fontWeight: 700, x: 14, y: 110, fontFamily: 'monospace' }
      },
      ports: {
        groups: {
          in: { position: 'left', attrs: { circle: { r: 7, magnet: true, stroke: 'var(--accent-blue)', strokeWidth: 2.5, fill: 'var(--node-bg)' } } },
          out: { position: 'right', attrs: { circle: { r: 7, magnet: true, stroke: 'var(--accent-blue)', strokeWidth: 2.5, fill: 'var(--node-bg)' } } }
        },
        items: [{ id: 'port_in', group: 'in' }, { id: 'port_out', group: 'out' }]
      }
    });
  }
}
