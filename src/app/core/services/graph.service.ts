import { Injectable } from '@angular/core';
import { Graph, Node, Edge } from '@antv/x6';
import { Subject } from 'rxjs';
import { GlobalSettings, HydraGenConfig, ClusterLatency } from '../models/hydragen.model';

/** Trunca texto — garantiza que no desborda la caja SVG */
function trunc(text: string, maxChars: number): string {
  return text.length > maxChars ? text.substring(0, maxChars - 1) + '\u2026' : text;
}

@Injectable({ providedIn: 'root' })
export class GraphService {
  private graph: Graph | null = null;
  private globalSettings: GlobalSettings = {
    logging: true,
    development: true,
    base_image: ''
  };
  private clusterLatencies: ClusterLatency[] = [];

  private nodeSelectedSource = new Subject<Node | null>();
  nodeSelected$ = this.nodeSelectedSource.asObservable();

  private edgeSelectedSource = new Subject<Edge | null>();
  edgeSelected$ = this.edgeSelectedSource.asObservable();

  // ── Apply confirmation event ──────────────────────────────────────────────
  private applyConfirmedSource = new Subject<void>();
  applyConfirmed$ = this.applyConfirmedSource.asObservable();
  notifyApply() { this.applyConfirmedSource.next(); }

  setGraph(graph: Graph) {
    this.graph = graph;

    this.graph.on('node:click', ({ node }) => {
      this.edgeSelectedSource.next(null);
      this.nodeSelectedSource.next(node);
    });

    this.graph.on('edge:click', ({ edge }) => {
      this.nodeSelectedSource.next(null);
      this.edgeSelectedSource.next(edge);
    });

    this.graph.on('blank:click', () => {
      this.nodeSelectedSource.next(null);
      this.edgeSelectedSource.next(null);
    });
  }

  getGraph(): Graph | null { return this.graph; }

  addNode(metadata: Node.Metadata): Node | undefined {
    return this.graph?.addNode(metadata);
  }

  clear() { this.graph?.clearCells(); }

  getSettings(): GlobalSettings { return { ...this.globalSettings }; }

  setSettings(settings: GlobalSettings) {
    this.globalSettings = {
      ...settings,
      logging: true,
      development: true
    };
  }

  getClusterLatencies(): ClusterLatency[] { return this.clusterLatencies; }

  setClusterLatencies(latencies: ClusterLatency[]) {
    this.clusterLatencies = latencies || [];
  }

  /** Recalculates node visual attrs from its current data */
  refreshNodeVisuals(node: Node) {
    const data = (node.getData() || {}) as any;
    const endpoints: any[] = data.endpoints || [];

    const badges: string[] = [];
    if (endpoints.some((ep: any) => ep.resilience_patterns?.timeout)) badges.push('TO');
    if (endpoints.some((ep: any) => ep.resilience_patterns?.retry)) badges.push('RT');
    if (endpoints.some((ep: any) => ep.resilience_patterns?.fallback)) badges.push('FB');

    const name = data.name || 'Service';
    const protocol = (data.protocol || 'http').toUpperCase();
    const cpuReq = data.resources?.requests?.cpu || '500m';
    const cpuLim = data.resources?.limits?.cpu || '1000m';
    const memReq = data.resources?.requests?.memory || '256M';
    const memLim = data.resources?.limits?.memory || '1024M';
    const replicas = data.clusters?.[0]?.replicas ?? 1;
    const cluster = data.clusters?.[0]?.cluster || 'cluster1';

    try { node.attr('title/text', trunc(name, 20)); node.attr('title/fill', 'var(--node-text)'); node.attr('title/fontSize', 13); node.attr('title/fontWeight', 700); } catch (_) { }
    try { node.attr('badge/text', protocol); node.attr('badge/fill', 'var(--node-badge-text)'); node.attr('badgeBg/fill', 'var(--node-badge-bg)'); } catch (_) { }
    try { node.attr('patternBadges/text', badges.join('  ')); node.attr('patternBadges/fill', 'var(--accent-blue)'); } catch (_) { }
    try { node.attr('resources/text', trunc(`CPU ${cpuReq}/${cpuLim}  MEM ${memReq}/${memLim}`, 36)); node.attr('resources/fill', 'var(--node-text-muted)'); node.attr('resources/fontSize', 11); } catch (_) { }
    try { node.attr('cluster/text', trunc(`Replicas ${replicas}  Cluster ${cluster}`, 34)); node.attr('cluster/fill', 'var(--node-text-muted)'); node.attr('cluster/fontSize', 11); } catch (_) { }
    try { node.attr('divider/stroke', 'var(--node-divider)'); } catch (_) { }
    try { node.attr('icon/fill', 'var(--text-muted)'); } catch (_) { }
    try { node.attr('body/fill', 'var(--node-bg)'); node.attr('body/stroke', 'var(--node-border)'); } catch (_) { }
  }

  importConfig(config: HydraGenConfig) {
    if (!this.graph) return;

    this.setSettings(config.settings || this.globalSettings);
    this.setClusterLatencies(config.cluster_latencies || []);
    this.graph.clearCells();

    const nodeMap = new Map<string, Node>();
    const spacingX = 300, spacingY = 200, baseX = 100, baseY = 100;

    config.services.forEach((service, index) => {
      const x = baseX + (index % 3) * spacingX;
      const y = baseY + Math.floor(index / 3) * spacingY;
      const endpoints = (service.endpoints || []).map(ep => {
        const epData = { ...ep };
        // Si el endpoint no tiene patrones pero los llamados sí, los reconstruimos
        if (!epData.resilience_patterns) {
          const calledWithPatterns = (ep.network_complexity?.called_services || [])
            .find(c => c.resilience_patterns);

          if (calledWithPatterns && calledWithPatterns.resilience_patterns) {
            const rp = calledWithPatterns.resilience_patterns as any;
            const newRp: any = {};
            if (rp.timeout) newRp.timeout = { ...rp.timeout };
            if (rp.exponential_backoff) {
              newRp.retry = {
                max_attempts: rp.exponential_backoff.max_attempts,
                backoff_ms: (rp.exponential_backoff.initial || 0) * 1000,
                backoff_multiplier: rp.exponential_backoff.multiplier,
                max_backoff_ms: (rp.exponential_backoff.max || 0) * 1000
              };
            }
            if (rp.fallback) newRp.fallback = { ...rp.fallback };
            epData.resilience_patterns = newRp;
          }
        }
        return epData;
      });

      const badges: string[] = [];
      if (endpoints.some((ep: any) => ep.resilience_patterns?.timeout)) badges.push('TO');
      if (endpoints.some((ep: any) => ep.resilience_patterns?.retry)) badges.push('RT');
      if (endpoints.some((ep: any) => ep.resilience_patterns?.fallback)) badges.push('FB');

      const node = this.graph!.addNode({
        x, y, width: 260, height: 130, shape: 'service-node',
        data: {
          rawType: 'service',
          name: service.name,
          protocol: service.protocol,
          clusters: service.clusters,
          resources: service.resources,
          processes: service.processes,
          readiness_probe: service.readiness_probe,
          base_image: service.base_image || '',
          endpoints
        },
        attrs: {
          divider: { x1: 0, y1: 42, x2: 260, y2: 42, stroke: 'var(--node-divider)', strokeWidth: 1 },
          icon: { text: '\u25c9', fill: 'var(--text-muted)', fontSize: 14, x: 14, y: 26 },
          title: { text: trunc(service.name, 20), fill: 'var(--node-text)', fontSize: 13, fontWeight: 700, x: 34, y: 26 },
          badgeBg: { fill: 'var(--node-badge-bg)', rx: 5, ry: 5, width: 44, height: 18, refX: '100%', refX2: -56, y: 11 },
          badge: { text: (service.protocol || 'http').toUpperCase(), fill: 'var(--node-badge-text)', fontSize: 9, fontWeight: 600, refX: '100%', refX2: -52, y: 23 },
          resources: { text: trunc(`CPU ${service.resources?.requests?.cpu || '500m'}/${service.resources?.limits?.cpu || '1000m'}  MEM ${service.resources?.requests?.memory || '256M'}/${service.resources?.limits?.memory || '1024M'}`, 36), fill: 'var(--node-text-muted)', fontSize: 11, x: 14, y: 68, fontFamily: 'monospace' },
          cluster: { text: trunc(`Replicas ${service.clusters?.[0]?.replicas ?? 1}  Cluster ${service.clusters?.[0]?.cluster || 'cluster1'}`, 34), fill: 'var(--node-text-muted)', fontSize: 11, x: 14, y: 86, fontFamily: 'monospace' },
          patternBadges: { text: badges.join('  '), fill: 'var(--accent-blue)', fontSize: 10, fontWeight: 700, x: 14, y: 110, fontFamily: 'monospace' }
        },
        ports: {
          groups: {
            in: { position: 'left', attrs: { circle: { r: 7, magnet: true, stroke: '#007acc', strokeWidth: 2, fill: '#1a1a1a' } } },
            out: { position: 'right', attrs: { circle: { r: 7, magnet: true, stroke: '#007acc', strokeWidth: 2, fill: '#1a1a1a' } } }
          },
          items: [{ id: 'port_in', group: 'in' }, { id: 'port_out', group: 'out' }]
        }
      });

      if (node) nodeMap.set(service.name, node);
    });

    // Create edges from called_services
    config.services.forEach(service => {
      const srcNode = nodeMap.get(service.name);
      if (!srcNode) return;

      (service.endpoints || []).forEach(endpoint => {
        (endpoint.network_complexity?.called_services || []).forEach(called => {
          const tgtNode = nodeMap.get(called.service);
          if (tgtNode && this.graph) {
            this.graph.addEdge({
              source: { cell: srcNode.id, port: 'port_out' },
              target: { cell: tgtNode.id, port: 'port_in' },
              attrs: { line: { stroke: '#a0a0a0', strokeWidth: 2, targetMarker: { name: 'block', size: 12 } } },
              data: {
                sourceEndpoint: endpoint.name,
                targetEndpoint: called.endpoint,
                port: called.port,
                protocol: called.protocol,
                traffic_forward_ratio: called.traffic_forward_ratio,
                request_payload_size: called.request_payload_size,
                active_circuit_breaker: called.active_circuit_breaker || !!endpoint.resilience_patterns?.circuit_breaker,
                active_timeout: called.active_timeout || !!called.resilience_patterns?.timeout,
                active_retry: called.active_retry || !!(called.resilience_patterns as any)?.exponential_backoff,
                active_fallback: called.active_fallback || !!called.resilience_patterns?.fallback
              }
            });
          }
        });
      });
    });
  }
}
