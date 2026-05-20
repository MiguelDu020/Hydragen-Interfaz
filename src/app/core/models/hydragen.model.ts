import { ResiliencePatterns } from './resilience.model';

export interface HydraGenConfig {
  settings: GlobalSettings;
  cluster_latencies?: ClusterLatency[];
  services: Service[];
}

export interface ClusterDefinition {
  name: string;
  namespace: string;
}

export interface GlobalSettings {
  logging: boolean;
  development: boolean;
  base_image: string;

  clusters: ClusterDefinition[];
}

export interface ClusterLatency {
  src: string;
  dest: string;
  latency: number;
}

export interface Service {
  name: string;
  protocol: 'http' | 'grpc';
  replicas: number;
  clusters: ClusterConfig[];
  resources: Resources;
  processes: number;
  readiness_probe: number;
  logging?: boolean;
  development?: boolean;
  base_image?: string;
  endpoints: Endpoint[];
  // resilience_patterns is at ENDPOINT level, NOT service level
}

export interface ClusterConfig {
  cluster: string;
  namespace: string;
  node?: string;
  annotations?: Record<string, string> | Annotation[];
}

export interface Annotation {
  name: string;
  value: string;
}

export interface Resources {
  limits: ResourceSpec;
  requests: ResourceSpec;
}

export interface ResourceSpec {
  cpu: string;
  memory: string;
}

export interface Endpoint {
  name: string;
  execution_mode: 'sequential' | 'parallel';
  cpu_complexity: CpuComplexity;
  network_complexity: NetworkComplexity;
  resilience_parameters?: ResiliencePatterns; // ← at endpoint level
}

export interface CpuComplexity {
  execution_time: number;
  threads: number;
}

export interface NetworkComplexity {
  forward_requests: 'synchronous' | 'asynchronous' | 'none';
  response_payload_size: number;
  called_services: CalledService[];
}

export interface CalledService {
  service: string;
  endpoint: string;
  port: number;
  protocol: 'http' | 'grpc';
  traffic_forward_ratio: number;
  request_payload_size: number;
  active_circuit_breaker?: boolean;
}
