import { Injectable } from '@angular/core';
import { GraphService } from './graph.service';

@Injectable({
  providedIn: 'root'
})
export class PatternService {
  constructor(private graphService: GraphService) {}

  private makeNodeMeta(name: string, x: number, y: number, type = 'microservice') {
    const icon = type === 'gateway' ? '[GW]' : type === 'backend' ? '[DB]' : '[SVC]';
    return {
      x, y,
      width: 200,
      height: 110,
      shape: 'rect',
      data: {
        rawType: type,
        name,
        protocol: 'http',
        clusters: [{ cluster: 'cluster1', replicas: 1, namespace: 'default' }],
        resources: { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
        endpoints: []
      },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'line', selector: 'divider' },
        { tagName: 'text', selector: 'icon' },
        { tagName: 'text', selector: 'title' },
        { tagName: 'rect', selector: 'badgeBg' },
        { tagName: 'text', selector: 'badge' },
        { tagName: 'text', selector: 'line1' },
        { tagName: 'text', selector: 'line2' },
      ],
      attrs: {
        body: { refWidth: '100%', refHeight: '100%', fill: '#141414', stroke: '#2a2a2a', strokeWidth: 1, rx: 8, ry: 8 },
        divider: { x1: 0, y1: 36, x2: 200, y2: 36, stroke: '#2a2a2a', strokeWidth: 1 },
        icon: { text: icon, fill: '#fff', fontSize: 10, x: 10, y: 22, fontFamily: 'monospace' },
        title: { text: name.substring(0, 16), fill: '#fff', fontSize: 13, fontWeight: 500, x: 50, y: 22 },
        badgeBg: { fill: '#007bff', rx: 4, ry: 4, width: 34, height: 16, refX: '100%', refX2: -44, y: 10 },
        badge: { text: 'HTTP', fill: '#fff', fontSize: 9, refX: '100%', refX2: -40, y: 22 },
        line1: { text: 'CPU: 500m/1000m  MEM: 256M/1G', fill: '#a0a0a0', fontSize: 10, x: 10, y: 56, fontFamily: 'monospace' },
        line2: { text: 'Replicas: 1  Cluster: cluster1', fill: '#a0a0a0', fontSize: 10, x: 10, y: 74, fontFamily: 'monospace' }
      },
      ports: {
        groups: {
          in: { position: 'left', attrs: { circle: { r: 6, magnet: true, stroke: '#007bff', strokeWidth: 2, fill: '#141414' } } },
          out: { position: 'right', attrs: { circle: { r: 6, magnet: true, stroke: '#007bff', strokeWidth: 2, fill: '#141414' } } }
        },
        items: [{ id: 'port_in', group: 'in' }, { id: 'port_out', group: 'out' }]
      }
    };
  }

  private edgeAttrs() {
    return { line: { stroke: '#007bff', strokeWidth: 2, targetMarker: { name: 'block', size: 10 } } };
  }

  applyChain(count: number, startX: number, startY: number) {
    const graph = this.graphService.getGraph();
    if (!graph) return;
    let prevNode: any = null;
    for (let i = 0; i < count; i++) {
      const node = graph.addNode(this.makeNodeMeta(`chain-svc-${i + 1}`, startX + (i * 260), startY));
      if (prevNode) {
        graph.addEdge({ source: prevNode, target: node, attrs: this.edgeAttrs() });
      }
      prevNode = node;
    }
  }

  applyFanOut(branches: number, startX: number, startY: number) {
    const graph = this.graphService.getGraph();
    if (!graph) return;
    const gateway = graph.addNode(this.makeNodeMeta('gateway', startX, startY + 120, 'gateway'));
    const gap = 160;
    const totalHeight = (branches - 1) * gap;
    for (let i = 0; i < branches; i++) {
      const y = startY - totalHeight / 2 + i * gap;
      const svc = graph.addNode(this.makeNodeMeta(`fanout-svc-${i + 1}`, startX + 280, y));
      graph.addEdge({ source: gateway, target: svc, attrs: this.edgeAttrs() });
    }
  }

  applyFanIn(branches: number, startX: number, startY: number) {
    const graph = this.graphService.getGraph();
    if (!graph) return;
    const aggregator = graph.addNode(this.makeNodeMeta('aggregator', startX + 280, startY + 120));
    const gap = 160;
    const totalHeight = (branches - 1) * gap;
    for (let i = 0; i < branches; i++) {
      const y = startY - totalHeight / 2 + i * gap;
      const svc = graph.addNode(this.makeNodeMeta(`fanin-svc-${i + 1}`, startX, y));
      graph.addEdge({ source: svc, target: aggregator, attrs: this.edgeAttrs() });
    }
  }
}
