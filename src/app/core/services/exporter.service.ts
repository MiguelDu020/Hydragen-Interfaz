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

    const config: HydraGenConfig = {
      settings: this.graphService.getSettings(),
      cluster_latencies: this.graphService.getClusterLatencies(),
      services: []
    };

    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    nodes.forEach(node => {
      const nodeData = (node.getData() || {}) as any;
      const clusters = (nodeData.clusters || [ { cluster: 'cluster1', replicas: 1, namespace: 'default' } ]).map((cluster: any) => ({
        cluster: cluster.cluster || 'cluster1',
        replicas: cluster.replicas ?? 1,
        namespace: cluster.namespace || 'default',
        node: cluster.node || '',
        annotations: this.normalizeAnnotations(cluster.annotations)
      }));

      const service: Service = {
        name: nodeData.name || 'unnamed-service',
        protocol: nodeData.protocol || 'http',
        clusters,
        resources: nodeData.resources || { limits: { cpu: '1000m', memory: '1024M' }, requests: { cpu: '500m', memory: '256M' } },
        processes: nodeData.processes || 0,
        readiness_probe: nodeData.readiness_probe || 1,
        logging: nodeData.logging ?? false,
        development: nodeData.development ?? false,
        base_image: nodeData.base_image || 'ubuntu:20.04',
        endpoints: nodeData.endpoints || [],
        resilience_patterns: nodeData.resilience_patterns || {}
      };

      if (service.endpoints.length === 0) {
        service.endpoints.push({
          name: 'default-endpoint',
          execution_mode: 'sequential',
          cpu_complexity: { execution_time: 0.1, threads: 1 },
          network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
        });
      }

      const outgoingEdges = edges.filter(e => e.getSourceCellId() === node.id);
      outgoingEdges.forEach(edge => {
        const targetNode = graph.getCellById(edge.getTargetCellId() as string);
        if (targetNode && targetNode.isNode()) {
          const targetData = (targetNode.getData() || {}) as any;
          const edgeData = edge.getData() || {};
          const calledService: CalledService = {
            service: targetData.name || 'unknown-service',
            endpoint: targetData.endpoints?.[0]?.name || 'default-endpoint',
            port: edgeData.port || '80',
            protocol: edgeData.protocol || targetData.protocol || 'http',
            traffic_forward_ratio: edgeData.traffic_forward_ratio ?? 1,
            request_payload_size: edgeData.request_payload_size ?? 0
          };
          if (!service.endpoints[0].network_complexity.called_services) {
            service.endpoints[0].network_complexity.called_services = [];
          }
          service.endpoints[0].network_complexity.called_services.push(calledService);
        }
      });

      config.services.push(service);
    });

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
