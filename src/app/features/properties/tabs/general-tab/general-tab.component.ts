import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-general-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="tab-form">
      <div class="field">
        <label>Nombre del servicio</label>
        <input formControlName="name" type="text" placeholder="api-gateway" />
        <span class="error" *ngIf="form.get('name')?.invalid && form.get('name')?.touched">
          Solo minúsculas, números y guiones (a-z, 0-9, -)
        </span>
      </div>
      <div class="field">
        <label>Protocolo</label>
        <select formControlName="protocol">
          <option value="http">HTTP</option>
          <option value="grpc">gRPC</option>
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Procesos</label>
          <input formControlName="processes" type="number" min="0" />
        </div>
        <div class="field">
          <label>Readiness Probe (s)</label>
          <input formControlName="readiness_probe" type="number" min="1" />
        </div>
      </div>
      <div class="field">
        <label>Base Image</label>
        <input formControlName="base_image" type="text" placeholder="ubuntu:20.04" />
      </div>
      <div class="toggles">
        <label class="toggle-row">
          <span class="toggle-label">Logging</span>
          <input type="checkbox" formControlName="logging" />
          <span class="toggle-track"></span>
        </label>
        <label class="toggle-row">
          <span class="toggle-label">Development Mode</span>
          <input type="checkbox" formControlName="development" />
          <span class="toggle-track"></span>
        </label>
      </div>
    </form>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;
    .tab-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 5px;
      label { font-size: 11px; color: $text-secondary; font-weight: 500; }
      input, select { width: 100%; }
      .error { font-size: 10px; color: $danger; }
    }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .toggles { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
    .toggle-row {
      display: flex; align-items: center; justify-content: space-between; cursor: pointer;
      .toggle-label { font-size: 12px; color: $text-primary; }
      input[type="checkbox"] { display: none; }
      .toggle-track {
        width: 34px; height: 18px; background: #333; border-radius: 9px; position: relative; transition: background 0.2s;
        &::after { content: ''; position: absolute; width: 14px; height: 14px; background: #888; border-radius: 50%; top: 2px; left: 2px; transition: all 0.2s; }
      }
      input:checked + .toggle-track { background: $accent-blue;
        &::after { left: 18px; background: white; }
      }
    }
  `]
})
export class GeneralTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Output() dataChange = new EventEmitter<any>();

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      name:           ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      protocol:       ['http'],
      processes:      [1, [Validators.min(0)]],
      readiness_probe:[2, [Validators.min(1)]],
      base_image:     [''],
      logging:        [false],
      development:    [false]
    });
    this.form.valueChanges.subscribe(v => {
      this.dataChange.emit({ ...this.nodeData, ...v });
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      this.form.patchValue({
        name:           this.nodeData.name           || '',
        protocol:       this.nodeData.protocol       || 'http',
        processes:      this.nodeData.processes      ?? 1,
        readiness_probe:this.nodeData.readiness_probe ?? 2,
        base_image:     this.nodeData.base_image     || '',
        logging:        this.nodeData.logging        ?? false,
        development:    this.nodeData.development    ?? false
      }, { emitEvent: false });
    }
  }
}
