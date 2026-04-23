import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';
import { GraphService } from './graph.service';
import { HydraGenConfig, Service, CalledService } from '../models/hydragen.model';

@Injectable({
  providedIn: 'root'
})
export class ExporterService {
  constructor(private graphService: GraphService) {}

  private normalizeAnnotations(annotations: any): Record<string, string> {
    if (!annotations) {
      return {};
    }
    if (Array.isArray(annotations)) {
      return annotations.reduce((acc: Record<string, string>, item: any, index: number) => {
        if (item && typeof item.key === 'string' && item.key.length > 0) {
          acc[item.key] = String(item.value ?? '');
        } else {
          acc[`annotation_${index}`] = String(item?.value ?? '');
        }
        return acc;
      }, {});
    }
    return annotations;
  }

  generateConfig(): HydraGenConfig {
    const graph = this.graphService.getGraph();
    if (!graph) throw new Error('Graph not initialized');

    const latencies = this.graphService.getClusterLatencies();

    const config: any = {
      cluster_latencies: latencies && latencies.length > 0 ? latencies : null,
      services: []
    };

    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    nodes.forEach(node => {
      const nodeData = (node.getData() || {}) as any;
      const clusters = (nodeData.clusters || [ { cluster: 'cluster1', replicas: 1, namespace: 'default' } ]).map((cluster: any) => {
        const c: any = {
          cluster: cluster.cluster || 'cluster1',
          replicas: cluster.replicas ?? 1,
          namespace: cluster.namespace || 'default'
        };
        if (cluster.node) c.node = cluster.node;
        const annotations = this.normalizeAnnotations(cluster.annotations);
        if (Object.keys(annotations).length > 0) c.annotations = annotations;
        return c;
      });

      const service: any = {
        name: nodeData.name || 'unnamed-service',
        clusters,
        resources: nodeData.resources || { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
        processes: nodeData.processes || 0,
        readiness_probe: nodeData.readiness_probe || 1,
        protocol: nodeData.protocol || 'http',
      };

      if (nodeData.logging !== undefined && nodeData.logging !== false) service.logging = nodeData.logging;
      if (nodeData.development !== undefined && nodeData.development !== false) service.development = nodeData.development;
      if (nodeData.base_image) service.base_image = nodeData.base_image;
      
      service.endpoints = JSON.parse(JSON.stringify(nodeData.endpoints || [])); // deep copy

      if (nodeData.resilience_patterns && Object.keys(nodeData.resilience_patterns).length > 0) {
        service.resilience_patterns = nodeData.resilience_patterns;
      }

      if (service.endpoints.length === 0) {
        service.endpoints.push({
          name: 'default-endpoint',
          execution_mode: 'sequential',
          cpu_complexity: { execution_time: 0.1, threads: 1 },
          network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
        });
      }

      const outgoingEdges = edges.filter(e => e.getSourceCellId() === node.id);
      
      // Limpiar called_services para reconstruirlo basado en las aristas
      service.endpoints[0].network_complexity.called_services = [];
      
      outgoingEdges.forEach(edge => {
        const targetNode = graph.getCellById(edge.getTargetCellId() as string);
        if (targetNode && targetNode.isNode()) {
          const targetData = (targetNode.getData() || {}) as any;
          const edgeData = edge.getData() || {};
          const calledService: CalledService = {
            service: targetData.name || 'unknown-service',
            port: edgeData.port || 80,
            endpoint: targetData.endpoints?.[0]?.name || 'end1',
            protocol: edgeData.protocol || targetData.protocol || 'http',
            traffic_forward_ratio: edgeData.traffic_forward_ratio ?? 1,
            request_payload_size: edgeData.request_payload_size ?? 128
          };
          service.endpoints[0].network_complexity.called_services.push(calledService);
        }
      });

      // Si no hay llamados, network_complexity debe estar acorde (ej. forward_requests: 'none')
      if (service.endpoints[0].network_complexity.called_services.length === 0) {
        service.endpoints[0].network_complexity.forward_requests = 'none';
      }

      config.services.push(service);
    });

    config.settings = this.graphService.getSettings();

    return config;
  }

  exportToJson(): string {
    return JSON.stringify(this.generateConfig(), null, 2);
  }

  exportToYaml(): string {
    return yaml.dump(this.generateConfig(), { indent: 2 });
  }

  downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
