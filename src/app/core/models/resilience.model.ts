// core/models/resilience.model.ts

export interface ResiliencePatterns {
  timeout?: TimeoutConfig;
  retry?: RetryConfig;
  fallback?: FallbackConfig;
}

export interface TimeoutConfig {
  duration_ms: number; // milisegundos
}

export interface RetryConfig {
  max_attempts: number;
  backoff_ms: number;
  backoff_multiplier: number;
  max_backoff_ms: number;
}

export interface FallbackConfig {
  type: string;
  response_code?: number;
  response_payload?: string;
  service?: string;
  endpoint?: string;
  port?: number;
}

