import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';
import { GraphService } from './graph.service';
import { HydraGenConfig, CalledService } from '../models/hydragen.model';

@Injectable({ providedIn: 'root' })
export class ExporterService {
  constructor(private graphService: GraphService) {}

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
    const settings  = this.graphService.getSettings();
    const nodes     = graph.getNodes();
    const allEdges  = graph.getEdges();

    const services: any[] = nodes.map(node => {
      const nd = (node.getData() || {}) as any;

      // --- Clusters ---
      const clusters = (nd.clusters || [{ cluster: 'cluster1', replicas: 1, namespace: 'default' }])
        .map((c: any) => {
          const out: any = {
            cluster:   c.cluster   || 'cluster1',
            replicas:  c.replicas  ?? 1,
            namespace: c.namespace || 'default'
          };
          if (c.node) out.node = c.node;
          const ann = this.normalizeAnnotations(c.annotations);
          if (ann) out.annotations = ann;
          return out;
        });

      // --- Service base ---
      const service: any = {
        name:           nd.name     || 'unnamed-service',
        protocol:       nd.protocol || 'http',
        clusters,
        resources:      nd.resources || { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
        processes:      nd.processes      ?? 0,
        readiness_probe:nd.readiness_probe ?? 2
      };
      if (nd.logging)     service.logging     = nd.logging;
      if (nd.development) service.development = nd.development;
      if (nd.base_image)  service.base_image  = nd.base_image;

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

      service.endpoints = rawEndpoints.map((ep: any, epIdx: number) => {
        // Filter edges that belong to this endpoint
        const epEdges = outEdges.filter(edge => {
          const edData = (edge.getData() || {}) as any;
          const srcEp  = edData.sourceEndpoint;
          // If no sourceEndpoint set, assign to first endpoint
          return srcEp === ep.name || (srcEp === undefined && epIdx === 0);
        });

        // Determine if endpoint has any pattern configured
        const rp = ep.resilience_patterns || {};
        const hasAnyPattern = !!(rp.timeout || rp.retry || rp.fallback);

        // Build called_services from graph edges
        const calledServices: CalledService[] = epEdges.map(edge => {
          const ed      = (edge.getData() || {}) as any;
          const tgtNode = graph.getCellById(edge.getTargetCellId() as string);
          const tgtData = (tgtNode?.isNode() ? (tgtNode as any).getData() : {}) || {};

          const cs: CalledService = {
            service:              tgtData.name   || 'unknown',
            endpoint:             ed.targetEndpoint || (tgtData.endpoints?.[0]?.name) || 'end1',
            port:                 ed.port     ?? 80,
            protocol:             ed.protocol || tgtData.protocol || 'http',
            traffic_forward_ratio:ed.traffic_forward_ratio ?? 1,
            request_payload_size: ed.request_payload_size  ?? 0
          };

          // Add activation flags only when endpoint has patterns configured
          if (hasAnyPattern) {
            cs.active_timeout  = rp.timeout  ? (ed.active_timeout  ?? false) : false;
            cs.active_retry    = rp.retry    ? (ed.active_retry    ?? false) : false;
            cs.active_fallback = rp.fallback ? (ed.active_fallback ?? false) : false;
          }

          return cs;
        });

        // network_complexity
        const nc: any = {
          forward_requests:     ep.network_complexity?.forward_requests || (calledServices.length > 0 ? 'synchronous' : 'none'),
          response_payload_size: ep.network_complexity?.response_payload_size ?? 0,
          called_services:       calledServices
        };

        // Build endpoint output
        const endpointOut: any = {
          name:           ep.name           || `end${epIdx + 1}`,
          execution_mode: ep.execution_mode || 'sequential',
          cpu_complexity: {
            execution_time: ep.cpu_complexity?.execution_time ?? 0.001,
            threads:        ep.cpu_complexity?.threads        ?? 1
          },
          network_complexity: nc
        };

        // Resilience patterns — include only enabled sub-objects
        const rpOut: any = {};
        if (rp.timeout)  rpOut.timeout  = { duration_ms: rp.timeout.duration_ms ?? 5000 };
        if (rp.retry)    rpOut.retry    = { max_attempts: rp.retry.max_attempts ?? 3, backoff_ms: rp.retry.backoff_ms ?? 100, backoff_multiplier: rp.retry.backoff_multiplier ?? 2.0 };
        if (rp.fallback) rpOut.fallback = { fallback_response: rp.fallback.fallback_response || 'default-response', trigger_on_error_rate: rp.fallback.trigger_on_error_rate ?? 0.5 };
        if (Object.keys(rpOut).length > 0) endpointOut.resilience_patterns = rpOut;

        return endpointOut;
      });

      return service;
    });

    const config: any = { settings, services };
    if (latencies && latencies.length > 0) config.cluster_latencies = latencies;
    return config;
  }

  exportToJson(): string { return JSON.stringify(this.generateConfig(), null, 2); }
  exportToYaml(): string { return yaml.dump(this.generateConfig(), { indent: 2 }); }

  downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
}
