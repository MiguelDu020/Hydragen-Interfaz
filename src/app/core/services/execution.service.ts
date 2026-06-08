import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface ExecutionStatus {
  job_id: string;
  status: 'running' | 'completed' | 'failed';
  current_step: number;
  total_steps: number;
  step_name: string;
  error: string | null;
}

export interface LogLine {
  line: string;
  step: number;
  level: 'INFO' | 'WARN' | 'ERROR';
}

export interface ExecuteResponse {
  job_id: string;
  status: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly API_URL = 'http://localhost:8000';
  private eventSource: EventSource | null = null;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
  ) {}

  /** Check that the backend is reachable */
  checkHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.API_URL}/health`);
  }

  /** POST /execute — start the pipeline and get a job_id back */
  executeBenchmark(
    config: any,
    hydragenPath: string,
    sudoPassword = '',
    sshPassword = '',
    cleanupNamespace: boolean,
    namespace = '',
    username = '',
  ): Observable<ExecuteResponse> {
    return this.http.post<ExecuteResponse>(`${this.API_URL}/execute`, {
      config,
      hydragen_path: hydragenPath,
      sudo_password: sudoPassword,
      ssh_password: sshPassword,
      cleanup_namespace: cleanupNamespace,
      namespace: namespace,
      username: username,
    });
  }

  /** POST /cancel/{jobId} — stop the running benchmark */
  cancelBenchmark(jobId: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/cancel/${jobId}`, {});
  }

  /** POST /apply-faults — apply configured fault injections to architecture */
  applyFaults(
    config: any,
    sudoPassword = '',
  ): Observable<{ status: string; message: string; logs: string[] }> {
    return this.http.post<{ status: string; message: string; logs: string[] }>(
      `${this.API_URL}/apply-faults`,
      {
        config,
        sudo_password: sudoPassword,
      },
    );
  }

  /** POST /remove-faults — remove configured fault injection VirtualServices */
  removeFaults(
    config: any,
    sudoPassword = '',
  ): Observable<{ status: string; message: string; logs: string[] }> {
    return this.http.post<{ status: string; message: string; logs: string[] }>(
      `${this.API_URL}/remove-faults`,
      {
        config,
        sudo_password: sudoPassword,
      },
    );
  }

  /** GET /status/{jobId} — one-shot status poll */
  getStatus(jobId: string): Observable<ExecutionStatus> {
    return this.http.get<ExecutionStatus>(`${this.API_URL}/status/${jobId}`);
  }

  /**
   * GET /logs/{jobId} — Server-Sent Events stream.
   * Uses NgZone.run() so Angular's change detection fires on each event.
   */
  streamLogs(jobId: string): Observable<LogLine> {
    const subject = new Subject<LogLine>();

    this.closeStream(); // close any existing stream
    this.eventSource = new EventSource(`${this.API_URL}/logs/${jobId}`);

    this.eventSource.onmessage = (event: MessageEvent) => {
      this.ngZone.run(() => {
        try {
          const data: LogLine = JSON.parse(event.data);
          if (data.line === '__END__') {
            subject.complete();
            this.closeStream();
          } else {
            subject.next(data);
          }
        } catch {
          // ignore malformed events
        }
      });
    };

    this.eventSource.onerror = () => {
      this.ngZone.run(() => {
        subject.error('Error en la conexión SSE con el backend');
        this.closeStream();
      });
    };

    return subject.asObservable();
  }

  closeStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /** GET /metrics/start — starts the port-forward process */
  startMetrics(): Observable<{ status: string; url: string }> {
    return this.http.get<{ status: string; url: string }>(
      `${this.API_URL}/metrics/start`,
    );
  }

  /** GET /metrics/stop — stops the port-forward process */
  stopMetrics(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.API_URL}/metrics/stop`);
  }
}
