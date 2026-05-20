import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GraphService } from '../../../../core/services/graph.service';
import { ClusterDefinition } from '../../../../core/models/hydragen.model';

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
          <label>Réplicas</label>
          <input formControlName="replicas" type="number" min="1" />
        </div>
        <div class="field">
          <label>Procesos</label>
          <input formControlName="processes" type="number" min="0" />
        </div>
      </div>
      <div class="field">
        <label>Readiness Probe (s)</label>
        <input formControlName="readiness_probe" type="number" min="1" />
      </div>
      <div class="field">
        <label>Base Image</label>
        <input formControlName="base_image" type="text" placeholder="ubuntu:20.04" />
      </div>
      <div class="cluster-section">
        <div class="section-header">
          <div>
            <h3>Clusters</h3>
            <span>Selecciona dónde desplegar el servicio</span>
          </div>

          <div class="cluster-counter" *ngIf="availableClusters?.length">
            {{ (nodeData.clusters || []).length }}
            / {{ availableClusters.length }}
          </div>
        </div>

        <!-- EMPTY STATE -->
        <div class="cluster-empty" *ngIf="!availableClusters || availableClusters.length === 0">

          <div class="empty-icon">☸️</div>

          <div class="empty-title">
            No hay clusters disponibles
          </div>

          <div class="empty-text">
            Crea un cluster en la sección global para poder desplegar este servicio.
          </div>

          <button class="empty-action" (click)="goToGlobalSettings.emit()">
            Ir a configuración global
          </button>

        </div>

        <!-- LIST -->
        <div class="cluster-grid" *ngIf="availableClusters?.length">

          <div
            class="cluster-card"
            *ngFor="let cluster of availableClusters"
            [class.active]="isClusterAssigned(cluster.name)"
            (click)="toggleCluster(cluster, !isClusterAssigned(cluster.name))"
          >

            <div class="cluster-top">

              <div class="cluster-info">
                <div class="cluster-name-row">
                  <div class="cluster-name">
                    {{ cluster.name }}
                  </div>

                  <div class="namespace-badge">
                    {{ cluster.namespace }}
                  </div>
                </div>

                <div class="cluster-meta">
                  Kubernetes Cluster
                </div>
              </div>

              <div class="cluster-check">
                <input
                  type="checkbox"
                  [checked]="isClusterAssigned(cluster.name)"
                  (click)="$event.stopPropagation()"
                  (change)="toggleCluster(cluster, $any($event.target).checked)"
                />
              </div>

            </div>

            <div
              class="cluster-config"
              *ngIf="isClusterAssigned(cluster.name)"
              (click)="$event.stopPropagation()"
            >
              <div class="field">
                <label>Node específico</label>

                <input
                  type="text"
                  [value]="getClusterConfig(cluster.name)?.node || ''"
                  (input)="getClusterConfig(cluster.name).node = $any($event.target).value; emitChanges()"
                  placeholder="worker-1"
                />

                <span class="hint">
                  Opcional. Define un nodo específico.
                </span>
              </div>
            </div>

          </div>
        </div>
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
        width: 34px; height: 18px; background: var(--border-color); border-radius: 9px; position: relative; transition: background 0.2s;
        &::after { content: ''; position: absolute; width: 14px; height: 14px; background: var(--text-secondary); border-radius: 50%; top: 2px; left: 2px; transition: all 0.2s; }
      }
      input:checked + .toggle-track { background: var(--accent-blue);
        &::after { left: 18px; background: white; }
      }
    }
    .cluster-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 10px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: $text-primary;
      }

      span {
        font-size: 11px;
        color: $text-secondary;
      }
    }

    .cluster-counter {
      min-width: 32px;
      height: 32px;
      padding: 0 10px;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 999px;

      background: rgba(59, 130, 246, 0.12);
      color: var(--accent-blue);

      font-size: 12px;
      font-weight: 600;
    }

    .cluster-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .cluster-card {
      border: 1px solid var(--border-color);
      border-radius: 14px;

      padding: 14px;

      background: var(--panel-bg);

      cursor: pointer;

      transition:
        border-color 0.2s ease,
        transform 0.2s ease,
        background 0.2s ease,
        box-shadow 0.2s ease;

      &:hover {
        border-color: var(--accent-blue);
        transform: translateY(-1px);

        box-shadow:
          0 4px 12px rgba(0,0,0,0.08);
      }

      &.active {
        border-color: var(--accent-blue);

        background:
          linear-gradient(
            180deg,
            rgba(59,130,246,0.08),
            rgba(59,130,246,0.03)
          );

        box-shadow:
          0 0 0 1px rgba(59,130,246,0.15);
      }
    }

    .cluster-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .cluster-info {
      flex: 1;
      min-width: 0;
    }

    .cluster-name-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .cluster-name {
      font-size: 14px;
      font-weight: 600;
      color: $text-primary;
    }

    .namespace-badge {
      padding: 4px 8px;

      border-radius: 999px;

      background: rgba(255,255,255,0.06);

      border: 1px solid var(--border-color);

      font-size: 10px;
      font-weight: 600;

      color: $text-secondary;
    }

    .cluster-meta {
      margin-top: 6px;

      font-size: 11px;
      color: $text-secondary;
    }

    .cluster-check {
      input[type='checkbox'] {
        width: 18px;
        height: 18px;

        accent-color: var(--accent-blue);

        cursor: pointer;
      }
    }

    .cluster-config {
      margin-top: 14px;
      padding-top: 14px;

      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .hint {
      font-size: 10px;
      color: $text-secondary;
    }

    .cluster-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      padding: 22px;

      border: 1px dashed var(--border-color);
      border-radius: 14px;

      background: rgba(255,255,255,0.02);

      text-align: center;
    }

    .empty-icon {
      font-size: 22px;
      margin-bottom: 8px;
      opacity: 0.8;
    }

    .empty-title {
      font-size: 13px;
      font-weight: 600;
      color: $text-primary;
    }

    .empty-text {
      margin-top: 4px;
      font-size: 11px;
      color: $text-secondary;
      max-width: 260px;
      line-height: 1.4;
    }
  `]
})
export class GeneralTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Input() availableClusters: ClusterDefinition[] = [];
  @Output() dataChange = new EventEmitter<any>();
  @Output() goToGlobalSettings = new EventEmitter<void>();

  form: FormGroup;

  emitChanges() {
    this.dataChange.emit({
      ...this.nodeData,
      ...this.form.value,
      clusters: this.nodeData.clusters || []
    });
  }

  isClusterAssigned(clusterName: string): boolean {
    return (this.nodeData.clusters || [])
      .some((c: any) => c.cluster === clusterName);
  }

  emitChangesWithClusters(clusters: any[]) {
    this.dataChange.emit({
      ...this.nodeData,
      ...this.form.value,
      clusters
    });
  }

  toggleCluster(cluster: ClusterDefinition, checked: boolean) {
    const current = this.nodeData.clusters || [];

    let updated;

    if (checked) {
      updated = [
        ...current,
        {
          cluster: cluster.name,
          namespace: cluster.namespace,
          node: '',
          annotations: []
        }
      ];
    } else {
      updated = current.filter(
        (c: any) => c.cluster !== cluster.name
      );
    }

    this.emitChangesWithClusters(updated);
  }

  getClusterConfig(clusterName: string) {
    return (this.nodeData.clusters || [])
      .find((c: any) => c.cluster === clusterName);
  }

  constructor(private fb: FormBuilder, private graphService: GraphService) {
    this.form = this.fb.group({
      name:           ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      protocol:       ['http'],
      replicas:       [1, [Validators.required, Validators.min(1)]],
      processes:      [1, [Validators.min(0)]],
      readiness_probe:[2, [Validators.min(1)]],
      base_image:     [''],
    });
    this.form.valueChanges.subscribe(v => {
      this.dataChange.emit({
      ...this.nodeData,
      ...v,
      clusters: this.nodeData.clusters || []
    });
    });
    this.availableClusters = this.graphService.getSettings().clusters || [];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      this.form.patchValue({
        name:           this.nodeData.name           || '',
        protocol:       this.nodeData.protocol       || 'http',
        replicas:       this.nodeData.replicas       ?? 1,
        processes:      this.nodeData.processes      ?? 1,
        readiness_probe:this.nodeData.readiness_probe ?? 2,
        base_image:     this.nodeData.base_image     || ''
      }, { emitEvent: false });
    }
  }
}
