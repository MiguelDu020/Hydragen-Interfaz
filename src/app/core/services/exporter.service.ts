import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';
import { GraphService } from './graph.service';
import { HydraGenConfig, CalledService } from '../models/hydragen.model';

@Injectable({ providedIn: 'root' })
export class ExporterService {
  constructor(private graphService: GraphService) { }

  private normalizeAnnotations(annotations: any): Record<string, string> | null {
    if (!annotations) return null;
    if (Array.isArray(annotations)) {
      const result = annotations.reduce((acc: Record<string, string>, item: any, i: number) => {
        if (item && typeof item.key === 'string' && item.key.length > 0) {
          acc[item.key] = String(item.value ?? '');
        } else {
          acc[`annotation_${i}`] = String(item?.value ?? '');
        }
        return acc;
      }, {});
      return Object.keys(result).length > 0 ? result : null;
    }
    return Object.keys(annotations).length > 0 ? annotations : null;
  }

  generateConfig(): HydraGenConfig {
    const graph = this.graphService.getGraph();
    if (!graph) throw new Error('Graph not initialized');

    const latencies = this.graphService.getClusterLatencies();
    const settings = this.graphService.getSettings();
    const nodes = graph.getNodes();
    const allEdges = graph.getEdges();

    const services: any[] = nodes.map(node => {
      const nd = (node.getData() || {}) as any;

      // --- Clusters ---
      const clusters = (nd.clusters || [{ cluster: 'cluster1', replicas: 1, namespace: 'default' }])
        .map((c: any) => {
          const out: any = {
            cluster: c.cluster || 'cluster1',
            replicas: c.replicas ?? 1,
            namespace: c.namespace || 'default'
          };
          if (c.node) out.node = c.node;
          const ann = this.normalizeAnnotations(c.annotations);
          if (ann) out.annotations = ann;
          return out;
        });

      // --- Service base ---
      const service: any = {
        name: nd.name || 'unnamed-service',
        protocol: nd.protocol || 'http',
        clusters,
        resources: nd.resources || { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
        processes: nd.processes ?? 0,
        readiness_probe: nd.readiness_probe ?? 2
      };
      if (nd.base_image) service.base_image = nd.base_image;

      // --- Outgoing edges for this node ---
      const outEdges = allEdges.filter(e => e.getSourceCellId() === node.id);

      // --- Endpoints ---
      let rawEndpoints: any[] = JSON.parse(JSON.stringify(nd.endpoints || []));
      if (rawEndpoints.length === 0) {
        rawEndpoints = [{
          name: 'end1',
          execution_mode: 'sequential',
          cpu_complexity: { execution_time: 0.001, threads: 1 },
          network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
        }];
      }

      service.endpoints = (nd.endpoints || []).map((ep: any, epIdx: number) => {
        // Filter edges that belong to this endpoint
        const epEdges = outEdges.filter(edge => {
          const edData = edge.getData() || {};
          const srcEp = edData.sourceEndpoint;
          return srcEp === ep.name || (!srcEp && epIdx === 0);
        });

        // Resilience Patterns (from the source endpoint)
        const rp = ep.resilience_patterns || {};

        // Build called_services from graph edges
        const calledServices: any[] = epEdges.map(edge => {
          const ed = edge.getData() || {};
          const tgtNode = graph.getCellById(edge.getTargetCellId() as string);
          const tgtData = (tgtNode?.isNode() ? (tgtNode as any).getData() : {}) || {};

          const cs: any = {
            service: tgtData.name || 'unknown',
            endpoint: ed.targetEndpoint || (tgtData.endpoints?.[0]?.name) || 'end1',
            port: ed.port ?? 80,
            protocol: ed.protocol || tgtData.protocol || 'http',
            traffic_forward_ratio: ed.traffic_forward_ratio ?? 1,
            request_payload_size: ed.request_payload_size ?? 0
          };

          // Build Resilience Patterns for this specific call
          const csRp: any = {};

          // Retry -> exponential_backoff
          if (rp.retry) {
            csRp.exponential_backoff = {
              initial: (rp.retry.backoff_ms || 500) / 1000,
              max: (rp.retry.max_backoff_ms || 5000) / 1000,
              multiplier: rp.retry.backoff_multiplier || 2.0,
              max_attempts: rp.retry.max_attempts || 3
            };
          }

          // Timeout
          if (rp.timeout) {
            csRp.timeout = { duration: rp.timeout.duration_ms || 5000 };
          }

          // Fallback
          if (rp.fallback) {
            const fb = rp.fallback;
            const fallbackOutput: any = { type: fb.type || 'static' };
            
            if (fb.type === 'static') {
              fallbackOutput.response_code = fb.response_code ?? 200;
              fallbackOutput.response_payload = fb.response_payload || 'fallback-response';
            } else if (fb.type === 'service') {
              fallbackOutput.service = fb.service || 'fallback-service';
              fallbackOutput.endpoint = fb.endpoint || 'fallback-endpoint';
              fallbackOutput.port = fb.port ?? 80;
            }
            
            csRp.fallback = fallbackOutput;
          }

          if (Object.keys(csRp).length > 0) {
            cs.resilience_patterns = csRp;
          }

          return cs;
        });

        // Build endpoint output
        return {
          name: ep.name || `end${epIdx + 1}`,
          execution_mode: ep.execution_mode || 'sequential',
          cpu_complexity: {
            execution_time: ep.cpu_complexity?.execution_time || 0.001,
            threads: ep.cpu_complexity?.threads || 1
          },
          network_complexity: {
            forward_requests: ep.network_complexity?.forward_requests || (calledServices.length > 0 ? 'synchronous' : 'none'),
            response_payload_size: ep.network_complexity?.response_payload_size || 0,
            called_services: calledServices
          }
        };
      });

      return service;
    });

    const config: any = {
      cluster_latencies: (latencies && latencies.length > 0) ? latencies : null,
      services,
      settings
    };
    return config;
  }

  exportToJson(): string { return JSON.stringify(this.generateConfig(), null, 2); }
  exportToYaml(): string { return yaml.dump(this.generateConfig(), { indent: 2 }); }

  downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
}
