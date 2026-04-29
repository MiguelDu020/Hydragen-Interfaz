import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Graph, Shape, Node } from '@antv/x6';
import { GraphService } from '../../core/services/graph.service';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="canvas-container" #canvasContainer></div>
    <!-- Pattern drop toast -->
    <div class="pattern-toast" *ngIf="showToast">
      💡 Selecciona el nodo y configura el patrón en la pestaña <strong>Endpoints</strong>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    .canvas-container { width: 100%; height: 100%; outline: none; }
    .pattern-toast {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2d3d;
      border: 1px solid #007acc;
      color: #d9efff;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      animation: fadeInUp 0.2s ease;
      strong { color: #7dd3fc; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `]
})
export class EditorComponent implements AfterViewInit {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  private graph!: Graph;
  showToast = false;
  private toastTimer: any;

  constructor(private graphService: GraphService) {}

  ngAfterViewInit() { this.initGraph(); }

  private initGraph() {
    this.graph = new Graph({
      container: this.canvasContainer.nativeElement,
      background: { color: '#0a0a0a' },
      grid: { visible: true, type: 'dot', args: { color: '#1e1e1e', size: 20 } },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowMulti: 'withPort',
        connector: 'rounded',
        router: 'manhattan',
        createEdge: () => new Shape.Edge({
          attrs: { line: { stroke: '#a0a0a0', strokeWidth: 2, targetMarker: { name: 'block', size: 12 } } },
          data: {
            sourceEndpoint: '',
            targetEndpoint: 'end1',
            port: 80,
            protocol: 'http',
            traffic_forward_ratio: 1,
            request_payload_size: 0,
            active_timeout: false,
            active_retry: false,
            active_fallback: false
          }
        })
      },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      panning: { enabled: true }
    });

    this.graphService.setGraph(this.graph);
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) { event.preventDefault(); }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) return;

    const type = event.dataTransfer.getData('type');
    if (!type) return;

    const point = this.graph.clientToLocal({ x: event.clientX, y: event.clientY });
    const isPattern = ['timeout', 'retry', 'fallback'].includes(type);

    if (isPattern) {
      this.showPatternToast();
      return;
    }

    if (type === 'service') {
      this.createServiceNode(point.x, point.y);
    }
  }

  private showPatternToast() {
    this.showToast = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 3500);
  }

  private createServiceNode(x: number, y: number) {
    const name = `service-${Date.now()}`;
    this.graphService.addNode({
      x, y,
      width: 260,
      height: 130,
      shape: 'rect',
      data: {
        rawType: 'service',
        name,
        protocol: 'http',
        clusters: [{ cluster: 'cluster1', replicas: 1, namespace: 'default' }],
        resources: { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
        processes: 1,
        readiness_probe: 2,
        logging: false,
        development: false,
        base_image: '',
        endpoints: [{
          name: 'end1',
          execution_mode: 'sequential',
          cpu_complexity: { execution_time: 0.001, threads: 1 },
          network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
        }]
      },
      markup: [
        { tagName: 'rect', selector: 'bg' },
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
        bg:            { refWidth: '100%', refHeight: '100%', fill: '#1a1a1a', stroke: '#333', strokeWidth: 1.2, rx: 10, ry: 10 },
        divider:       { x1: 0, y1: 42, x2: 260, y2: 42, stroke: '#2a2a2a', strokeWidth: 1 },
        icon:          { text: '◉', fill: '#7f8c9d', fontSize: 14, x: 14, y: 26 },
        title:         { text: name, fill: '#e0e0e0', fontSize: 13, fontWeight: 600, x: 34, y: 26 },
        badgeBg:       { fill: '#1f4460', rx: 5, ry: 5, width: 44, height: 18, refX: '100%', refX2: -56, y: 11 },
        badge:         { text: 'HTTP', fill: '#d9efff', fontSize: 9, fontWeight: 600, refX: '100%', refX2: -52, y: 23 },
        resources:     { text: 'CPU 500m/1000m  MEM 256M/1024M', fill: '#a8a8a8', fontSize: 10, x: 14, y: 68, fontFamily: 'monospace' },
        cluster:       { text: 'Replicas 1  Cluster cluster1', fill: '#a8a8a8', fontSize: 10, x: 14, y: 86, fontFamily: 'monospace' },
        patternBadges: { text: '', fill: '#9cc8ff', fontSize: 10, fontWeight: 700, x: 14, y: 110, fontFamily: 'monospace' }
      },
      ports: {
        groups: {
          in:  { position: 'left',  attrs: { circle: { r: 7, magnet: true, stroke: '#007acc', strokeWidth: 2.5, fill: '#1a1a1a' } } },
          out: { position: 'right', attrs: { circle: { r: 7, magnet: true, stroke: '#007acc', strokeWidth: 2.5, fill: '#1a1a1a' } } }
        },
        items: [{ id: 'port_in', group: 'in' }, { id: 'port_out', group: 'out' }]
      }
    });
  }
}
