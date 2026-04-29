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
}

export interface FallbackConfig {
  fallback_response: string;
  trigger_on_error_rate: number; // 0.0 a 1.0
}
