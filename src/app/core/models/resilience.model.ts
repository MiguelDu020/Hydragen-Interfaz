// core/models/resilience.model.ts

export interface ResiliencePatterns {
  bulkhead?: BulkheadConfig;
  fallback?: FallbackConfig;
  load_shedding?: LoadSheddingConfig;
}

export interface BulkheadConfig {
  enabled: boolean;
  max_concurrent_calls: number;
  max_wait_duration_ms: number;
}

export interface FallbackConfig {
  enabled: boolean;
  fallback_response: string;
  trigger_on_error_rate: number;
}

export interface LoadSheddingConfig {
  enabled: boolean;
  max_requests_per_second: number;
  strategy: 'drop_newest' | 'drop_oldest' | 'random';
}
