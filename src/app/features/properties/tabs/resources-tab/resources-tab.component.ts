import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-resources-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="tab-form">
      <div class="section-title">Limits</div>
      <div class="field-row">
        <div class="field">
          <label>CPU Limit</label>
          <input formControlName="cpu_limit" type="text" placeholder="1000m" />
        </div>
        <div class="field">
          <label>Memory Limit</label>
          <input formControlName="mem_limit" type="text" placeholder="1024M" />
        </div>
      </div>
      <div class="section-title">Requests</div>
      <div class="field-row">
        <div class="field">
          <label>CPU Request</label>
          <input formControlName="cpu_req" type="text" placeholder="500m" />
        </div>
        <div class="field">
          <label>Memory Request</label>
          <input formControlName="mem_req" type="text" placeholder="256M" />
        </div>
      </div>
    </form>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;
    .tab-form { display: flex; flex-direction: column; gap: 12px; }
    .section-title { font-size: 11px; font-weight: 600; color: $accent-blue; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .field { display: flex; flex-direction: column; gap: 5px;
      label { font-size: 11px; color: $text-secondary; }
      input { width: 100%; }
    }
  `]
})
export class ResourcesTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Output() dataChange = new EventEmitter<any>();

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      cpu_limit: ['1000m'],
      mem_limit: ['1024M'],
      cpu_req:   ['500m'],
      mem_req:   ['256M']
    });
    this.form.valueChanges.subscribe(v => {
      const updated = {
        ...this.nodeData,
        resources: {
          limits:   { cpu: v.cpu_limit, memory: v.mem_limit },
          requests: { cpu: v.cpu_req,   memory: v.mem_req   }
        }
      };
      this.dataChange.emit(updated);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      this.form.patchValue({
        cpu_limit: this.nodeData.resources?.limits?.cpu    || '1000m',
        mem_limit: this.nodeData.resources?.limits?.memory || '1024M',
        cpu_req:   this.nodeData.resources?.requests?.cpu    || '500m',
        mem_req:   this.nodeData.resources?.requests?.memory || '256M'
      }, { emitEvent: false });
    }
  }
}
