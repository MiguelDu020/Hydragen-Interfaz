import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-fault-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="tab-form">
      <div class="field">
        <label>Tipo de Falla</label>
        <select formControlName="type">
          <option value="none">Ninguna</option>
          <option value="delay">Retraso (Delay)</option>
          <option value="abort">Abortar (Abort)</option>
        </select>
      </div>

      <div *ngIf="form.get('type')?.value !== 'none'" class="fault-config-section">
        
        <div class="field">
          <label>Porcentaje de solicitudes (%)</label>
          <input formControlName="percentage" type="number" min="1" max="100" />
          <span class="error" *ngIf="form.get('percentage')?.invalid && form.get('percentage')?.touched">
            El porcentaje debe estar entre 1 y 100.
          </span>
        </div>

        <div *ngIf="form.get('type')?.value === 'delay'" class="field">
          <label>Duración del retraso (segundos)</label>
          <input formControlName="delay_s" type="number" min="0.1" step="0.1" />
          <span class="error" *ngIf="form.get('delay_s')?.invalid && form.get('delay_s')?.touched">
            La duración debe ser mayor a 0.
          </span>
        </div>

        <div *ngIf="form.get('type')?.value === 'abort'">
          <div *ngIf="protocol === 'grpc'; else httpAbort" class="field">
            <label>Código de Estado gRPC</label>
            <select formControlName="grpc_status">
              <option value="UNAVAILABLE">UNAVAILABLE (14)</option>
              <option value="DEADLINE_EXCEEDED">DEADLINE_EXCEEDED (4)</option>
              <option value="INTERNAL">INTERNAL (13)</option>
              <option value="PERMISSION_DENIED">PERMISSION_DENIED (7)</option>
              <option value="UNAUTHENTICATED">UNAUTHENTICATED (16)</option>
              <option value="RESOURCE_EXHAUSTED">RESOURCE_EXHAUSTED (8)</option>
            </select>
          </div>
          <ng-template #httpAbort>
            <div class="field">
              <label>Código de Estado HTTP</label>
              <input formControlName="http_status" type="number" min="100" max="599" />
              <span class="error" *ngIf="form.get('http_status')?.invalid && form.get('http_status')?.touched">
                Estado HTTP válido (100-599).
              </span>
            </div>
          </ng-template>
        </div>

      </div>
    </form>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;
    .tab-form { display: flex; flex-direction: column; gap: 14px; }
    .fault-config-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px;
      border: 1px dashed var(--border-color);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.01);
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .field { display: flex; flex-direction: column; gap: 5px;
      label { font-size: 11px; color: $text-secondary; font-weight: 500; }
      input, select { width: 100%; }
      .error { font-size: 10px; color: $danger; }
    }
  `]
})
export class FaultTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Output() dataChange = new EventEmitter<any>();

  form: FormGroup;
  protocol: 'http' | 'grpc' = 'http';

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      type: ['none'],
      percentage: [100, [Validators.required, Validators.min(1), Validators.max(100)]],
      delay_s: [3.0, [Validators.required, Validators.min(0.1)]],
      http_status: [500, [Validators.required, Validators.min(100), Validators.max(599)]],
      grpc_status: ['UNAVAILABLE']
    });

    this.form.valueChanges.subscribe(v => {
      const updated = {
        ...this.nodeData,
        fault_injection: {
          type: v.type,
          percentage: v.percentage,
          delay_s: v.delay_s,
          http_status: v.http_status,
          grpc_status: v.grpc_status
        }
      };
      this.dataChange.emit(updated);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      this.protocol = this.nodeData.protocol || 'http';
      const fi = this.nodeData.fault_injection || {};
      this.form.patchValue({
        type: fi.type || 'none',
        percentage: fi.percentage ?? 100,
        delay_s: fi.delay_s ?? 3.0,
        http_status: fi.http_status ?? 500,
        grpc_status: fi.grpc_status || 'UNAVAILABLE'
      }, { emitEvent: false });
    }
  }
}
