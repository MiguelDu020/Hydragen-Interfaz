import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Graph, Shape, Node } from '@antv/x6';
import { GraphService } from '../../core/services/graph.service';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="canvas-container" #canvasContainer>
      <!-- AntV X6 graph will be injected here -->
    </div>
  `,
  styles: [`
    .canvas-container {
      width: 100%;
      height: 100%;
      outline: none;
    }
  `]
})
export class EditorComponent implements AfterViewInit {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  private graph!: Graph;

  constructor(private graphService: GraphService) {}

  ngAfterViewInit() {
    this.initGraph();
  }

  private initGraph() {
    this.graph = new Graph({
      container: this.canvasContainer.nativeElement,
      background: { color: '#0a0a0a' },
      grid: { 
        visible: true, 
        type: 'dot', 
        args: { color: '#1e1e1e', size: 20 } 
      },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowMulti: false,
        connector: 'rounded',
        router: 'manhattan',
        createEdge: () => new Shape.Edge({
          attrs: {
            line: {
              stroke: '#a0a0a0',
              strokeWidth: 2,
              targetMarker: { name: 'block', size: 12 }
            }
          }
        })
      },
      // selecting: { enabled: true, showNodeSelectionBox: true }, // Requires @antv/x6-plugin-selection in v2
      // history: { enabled: true }, // Requires @antv/x6-plugin-history in v2
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      panning: { enabled: true },
    });

    this.graphService.setGraph(this.graph);

    // Initial root node logic? Let user drag it.
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) return;

    const type = event.dataTransfer.getData('type');
    if (!type) return;

    // Convert screen coordinates to graph local coordinates
    const point = this.graph.clientToLocal({ x: event.clientX, y: event.clientY });

    const isPattern = ['fallback', 'bulkhead', 'loadshedding'].includes(type);
    if (isPattern) {
      const node = this.graph.getNodes().find(n => {
        const bbox = n.getBBox();
        return point.x >= bbox.x && point.x <= bbox.x + bbox.width &&
               point.y >= bbox.y && point.y <= bbox.y + bbox.height;
      });

      if (node) {
        this.applyPatternToNode(node, type);
      }
      return;
    }

    if (type === 'service') {
      this.createNode(type, point.x, point.y);
    }
  }

  private createNode(type: string, x: number, y: number) {
    // Only 'service' type per user request
    const title = 'Service';

    this.graphService.addNode({
      x,
      y,
      width: 240,
      height: 104,
      shape: 'rect',
      data: {
        name: `service-${Date.now()}`,
        protocol: 'http',
        clusters: [ { cluster: 'cluster1', replicas: 1, namespace: 'default' } ],
        resources: { limits: { cpu: '1000m', memory: '1024Mi' }, requests: { cpu: '500m', memory: '512Mi' } },
        endpoints: [],
        resilience_patterns: {}
      },
      markup: [
        { tagName: 'rect', selector: 'bg' },
        { tagName: 'line', selector: 'divider' },
        { tagName: 'text', selector: 'title' },
        { tagName: 'rect', selector: 'badgeBg' },
        { tagName: 'text', selector: 'badge' },
        { tagName: 'text', selector: 'patternBadges' }
      ],
      attrs: {
        bg: {
          refWidth: '100%',
          refHeight: '100%',
          fill: '#1a1a1a',
          stroke: '#333',
          strokeWidth: 1.2,
          rx: 10,
          ry: 10
        },
        divider: {
          x1: 0,
          y1: 38,
          x2: 240,
          y2: 38,
          stroke: '#2a2a2a',
          strokeWidth: 1
        },
        title: {
          text: title,
          fill: '#e0e0e0',
          fontSize: 13,
          fontWeight: 600,
          x: 14,
          y: 24
        },
        badgeBg: {
          fill: '#1f4460',
          rx: 5,
          ry: 5,
          width: 42,
          height: 18,
          refX: '100%',
          refX2: -54,
          y: 10
        },
        badge: {
          text: 'HTTP',
          fill: '#d9efff',
          fontSize: 9,
          fontWeight: 600,
          refX: '100%',
          refX2: -50,
          y: 22
        },
        patternBadges: {
          text: '',
          fill: '#9cc8ff',
          fontSize: 10,
          fontWeight: 700,
          x: 14,
          y: 64,
          fontFamily: 'monospace'
        }
      },
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: { 
              circle: { 
                r: 7, 
                magnet: true, 
                stroke: '#007acc', 
                strokeWidth: 2.5, 
                fill: '#1a1a1a' 
              } 
            }
          },
          out: {
            position: 'right',
            attrs: { 
              circle: { 
                r: 7, 
                magnet: true, 
                stroke: '#007acc', 
                strokeWidth: 2.5, 
                fill: '#1a1a1a' 
              } 
            }
          }
        },
        items: [
          { id: 'port_in', group: 'in' },
          { id: 'port_out', group: 'out' }
        ]
      }
    });
  }

  private applyPatternToNode(node: Node, patternType: string) {
    const data = { ...(node.getData() || {}) };
    const resilience = { ...(data.resilience_patterns || {}) };

    if (patternType === 'fallback') {
      resilience.fallback = {
        enabled: true,
        fallback_response: 'fallback-response',
        trigger_on_error_rate: 0.5
      };
    } else if (patternType === 'bulkhead') {
      resilience.bulkhead = {
        enabled: true,
        max_concurrent_calls: 10,
        max_wait_duration_ms: 100
      };
    } else if (patternType === 'loadshedding') {
      resilience.load_shedding = {
        enabled: true,
        max_requests_per_second: 100,
        strategy: 'drop_newest'
      };
    }

    data.resilience_patterns = resilience;
    node.setData(data);

    const badges: string[] = [];
    if (resilience.fallback?.enabled) badges.push('FB');
    if (resilience.bulkhead?.enabled) badges.push('BH');
    if (resilience.load_shedding?.enabled) badges.push('LS');

    node.attr('patternBadges/text', badges.join('  '));
  }
}
