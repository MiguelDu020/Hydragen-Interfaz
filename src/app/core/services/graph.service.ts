import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { Subject } from 'rxjs';
import { GlobalSettings, HydraGenConfig, ClusterLatency } from '../models/hydragen.model';

@Injectable({
  providedIn: 'root'
})
export class GraphService {
  private graph: Graph | null = null;
  private globalSettings: GlobalSettings = {
    logging: false,
    development: false,
    base_image: 'ubuntu:20.04'
  };
  private clusterLatencies: ClusterLatency[] = [];

  private nodeSelectedSource = new Subject<Node | null>();
  nodeSelected$ = this.nodeSelectedSource.asObservable();

  setGraph(graph: Graph) {
    this.graph = graph;

    this.graph.on('node:click', ({ node }) => {
      this.nodeSelectedSource.next(node);
    });

    this.graph.on('blank:click', () => {
      this.nodeSelectedSource.next(null);
    });
  }

  getGraph(): Graph | null {
    return this.graph;
  }

  addNode(metadata: Node.Metadata): Node | undefined {
    return this.graph?.addNode(metadata);
  }

  clear() {
    this.graph?.clearCells();
  }

  getSettings(): GlobalSettings {
    return this.globalSettings;
  }

  setSettings(settings: GlobalSettings) {
    this.globalSettings = {
      logging: settings.logging ?? this.globalSettings.logging,
      development: settings.development ?? this.globalSettings.development,
      base_image: settings.base_image || this.globalSettings.base_image
    };
  }

  getClusterLatencies(): ClusterLatency[] {
    return this.clusterLatencies;
  }

  setClusterLatencies(latencies: ClusterLatency[]) {
    this.clusterLatencies = latencies || [];
  }

  importConfig(config: HydraGenConfig) {
    if (!this.graph) return;

    this.setSettings(config.settings || this.globalSettings);
    this.setClusterLatencies(config.cluster_latencies || []);

    this.graph.clearCells();

    const gridX = 100;
    const gridY = 100;
    const spacingX = 280;
    const spacingY = 190;

    const nodeMap = new Map<string, Node>();

    config.services.forEach((service, index) => {
      const x = gridX + (index % 3) * spacingX;
      const y = gridY + Math.floor(index / 3) * spacingY;

      const resilience = service.resilience_patterns || {};
      const badges: string[] = [];
      if ((resilience as any).fallback?.enabled) badges.push('FB');
      if ((resilience as any).bulkhead?.enabled) badges.push('BH');
      if ((resilience as any).load_shedding?.enabled) badges.push('LS');

      const node = this.graph?.addNode({
        x,
        y,
        width: 268,
        height: 148,
        shape: 'rect',
        data: {
          rawType: 'service',
          name: service.name,
          protocol: service.protocol,
          clusters: service.clusters,
          resources: service.resources,
          processes: service.processes,
          readiness_probe: service.readiness_probe,
          logging: service.logging ?? false,
          development: service.development ?? false,
          base_image: service.base_image || 'ubuntu:20.04',
          endpoints: service.endpoints || [],
          resilience_patterns: resilience
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
          bg: { refWidth: '100%', refHeight: '100%', fill: '#1a1a1a', stroke: '#333', strokeWidth: 1.2, rx: 10, ry: 10 },
          divider: { x1: 0, y1: 42, x2: 268, y2: 42, stroke: '#2a2a2a', strokeWidth: 1 },
          icon: { text: '◉', fill: '#7f8c9d', fontSize: 14, x: 14, y: 26 },
          title: { text: service.name || 'Service', fill: '#e0e0e0', fontSize: 13, fontWeight: 600, x: 34, y: 26 },
          badgeBg: { fill: '#1f4460', rx: 5, ry: 5, width: 42, height: 18, refX: '100%', refX2: -56, y: 11 },
          badge: { text: (service.protocol || 'http').toUpperCase(), fill: '#d9efff', fontSize: 9, refX: '100%', refX2: -52, y: 23 },
          resources: { text: `CPU ${service.resources?.requests?.cpu || '500m'}/${service.resources?.limits?.cpu || '1000m'}  MEM ${service.resources?.requests?.memory || '512Mi'}/${service.resources?.limits?.memory || '1024Mi'}`, fill: '#a8a8a8', fontSize: 10, x: 14, y: 70, fontFamily: 'monospace' },
          cluster: { text: `Replicas ${service.clusters?.[0]?.replicas ?? 1}  Cluster ${service.clusters?.[0]?.cluster || 'cluster1'}`, fill: '#a8a8a8', fontSize: 10, x: 14, y: 90, fontFamily: 'monospace' },
          patternBadges: { text: badges.join('  '), fill: '#9cc8ff', fontSize: 10, fontWeight: 700, x: 14, y: 112, fontFamily: 'monospace' }
        },
        ports: {
          groups: {
            in: { position: 'left', attrs: { circle: { r: 7, magnet: true, stroke: '#007acc', strokeWidth: 2, fill: '#1a1a1a' } } },
            out: { position: 'right', attrs: { circle: { r: 7, magnet: true, stroke: '#007acc', strokeWidth: 2, fill: '#1a1a1a' } } }
          },
          items: [ { id: 'port_in', group: 'in' }, { id: 'port_out', group: 'out' } ]
        }
      }) as Node;

      if (node) {
        nodeMap.set(service.name, node);
      }
    });

    config.services.forEach(service => {
      const source = nodeMap.get(service.name);
      if (!source) return;

      const endpoint = service.endpoints?.[0];
      endpoint?.network_complexity?.called_services?.forEach(called => {
        const target = nodeMap.get(called.service);
        if (target && this.graph) {
          this.graph.addEdge({
            source: { cell: source.id, port: 'port_out' },
            target: { cell: target.id, port: 'port_in' },
            attrs: {
              line: { stroke: '#a0a0a0', strokeWidth: 2, targetMarker: { name: 'block', size: 12 } }
            },
            data: {
              port: called.port,
              protocol: called.protocol,
              traffic_forward_ratio: called.traffic_forward_ratio,
              request_payload_size: called.request_payload_size
            }
          });
        }
      });
    });
  }
}
