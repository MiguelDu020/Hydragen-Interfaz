import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';
import { GraphService } from './graph.service';
import { HydraGenConfig, CalledService } from '../models/hydragen.model';

@Injectable({ providedIn: 'root' })
export class ExporterService {
  constructor(private graphService: GraphService) { }

  private normalizeAnnotations(annotations: any): any[] | null {
    if (!annotations) return null;
    if (Array.isArray(annotations)) {
      return annotations
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          name: item.name,
          value: String(item.value ?? '')
        }));
    }
    // Si viene como objeto, convertir a array
    return Object.entries(annotations).map(([name, value]) => ({
      name,
      value: String(value)
    }));
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

      // --- Clusters (Replicas are now per-service) ---
      const clusters = (nd.clusters || []).map((c: any) => {
        // Try to find global definition for namespace fallback
        const globalDef = (settings.clusters || []).find((gc: any) => gc.name === c.cluster);
        return {
          cluster: c.cluster || 'cluster1',
          replicas: nd.replicas ?? 1,
          namespace: c.namespace || globalDef?.namespace || 'default'
        };
      });

      // Fallback if empty
      if (clusters.length === 0) {
        clusters.push({ cluster: 'cluster1', replicas: 1, namespace: 'default' });
      }

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
      service.endpoints = (nd.endpoints || []).map((ep: any, epIdx: number) => {
        // Filter edges that belong to this endpoint
        const epEdges = outEdges.filter(edge => {
          const edData = edge.getData() || {};
          const srcEp = edData.sourceEndpoint;
          return srcEp === ep.name || (!srcEp && epIdx === 0);
        });

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
            request_payload_size: ed.request_payload_size ?? 0,
            active_circuit_breaker: ed.active_circuit_breaker === true
          };

          return cs;
        });

        // Build Resilience Parameters for the ENDPOINT
        const rp = (ep as any).resilience_parameters || (ep as any).resilience_patterns || {};
        const outputRp: any = {};

        if (rp.timeout) {
          outputRp.timeout = { duration: rp.timeout.duration_s };
        }
        if (rp.retry) {
          outputRp.exponential_backoff = {
            initial: (rp.retry.backoff_ms || 100) / 1000,
            max: (rp.retry.max_backoff_ms || 5000) / 1000,
            multiplier: rp.retry.backoff_multiplier || 2.0,
            max_attempts: rp.retry.max_attempts || 3
          };
        }
        if (rp.fallback) {
          const fb = rp.fallback;
          outputRp.fallback = {
            type: fb.type || 'static',
            ...(fb.type === 'static' ? {
              response_code: fb.response_code ?? 200,
              response_payload: fb.response_payload || 'fallback-response'
            } : {
              service: fb.service || 'fallback-service',
              endpoint: fb.endpoint || 'fallback-endpoint',
              port: fb.port ?? 80
            })
          };
        }
        if (rp.circuit_breaker) {
          outputRp.circuit_breaker = {
            timeout: rp.circuit_breaker.timeout,
            retry_timer: rp.circuit_breaker.retry_timer
          };
        }

        // Build endpoint output
        const endpointOutput: any = {
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

        if (Object.keys(outputRp).length > 0) {
          endpointOutput.resilience_parameters = outputRp;
        }

        return endpointOutput;
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
