import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-resilience-tab',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="resilience-tab">
      <p class="hint">Resumen de los patrones configurados por endpoint. Para editar, ve a la pestaña <strong>Endpoints</strong>.</p>
      <table class="summary-table" *ngIf="rows.length > 0; else noEndpoints">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Timeout</th>
            <th>Retry</th>
            <th>Fallback</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td class="ep-name">{{ row.name }}</td>
            <td><span [class]="row.timeout ? 'badge on' : 'badge off'">{{ row.timeout || '✗' }}</span></td>
            <td><span [class]="row.retry   ? 'badge on' : 'badge off'">{{ row.retry   || '✗' }}</span></td>
            <td><span [class]="row.fallback? 'badge on' : 'badge off'">{{ row.fallback|| '✗' }}</span></td>
          </tr>
        </tbody>
      </table>
      <ng-template #noEndpoints>
        <p class="empty">No hay endpoints configurados.</p>
      </ng-template>
      <button class="btn-goto" (click)="goToEndpoints.emit()">Ir a Endpoints →</button>
    </div>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;
    .resilience-tab { display: flex; flex-direction: column; gap: 14px; }
    .hint { font-size: 11px; color: $text-secondary; line-height: 1.5;
      strong { color: $accent-blue; }
    }
    .summary-table { width: 100%; border-collapse: collapse; font-size: 12px;
      th { text-align: left; padding: 6px 8px; color: $text-secondary; font-weight: 500; border-bottom: 1px solid $border-color; }
      td { padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .ep-name { color: $text-primary; font-family: monospace; font-size: 11px; }
    }
    .badge {
      padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600;
      &.on  { background: rgba(0,200,100,0.15); color: #4ade80; border: 1px solid rgba(0,200,100,0.3); }
      &.off { background: rgba(255,255,255,0.04); color: $text-secondary; border: 1px solid $border-color; }
    }
    .empty { font-size: 12px; color: $text-secondary; }
    .btn-goto {
      align-self: flex-start; background: transparent; border: 1px solid $border-color;
      color: $accent-blue; padding: 6px 12px; border-radius: 6px; font-size: 12px;
      cursor: pointer; transition: all 0.15s;
      &:hover { border-color: $accent-blue; background: rgba(0,123,255,0.08); }
    }
  `]
})
export class ResilienceTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Output() goToEndpoints = new EventEmitter<void>();

  rows: Array<{ name: string; timeout: string; retry: string; fallback: string }> = [];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      this.rows = (this.nodeData.endpoints || []).map((ep: any) => {
        const rp = ep.resilience_patterns || {};
        return {
          name:     ep.name || '?',
          timeout:  rp.timeout  ? `✓ ${rp.timeout.duration_ms}ms`                                         : '',
          retry:    rp.retry    ? `✓ ${rp.retry.max_attempts} intentos`                                    : '',
          fallback: rp.fallback ? `✓ err≥${Math.round((rp.fallback.trigger_on_error_rate ?? 0.5) * 100)}%` : ''
        };
      });
    }
  }
}
