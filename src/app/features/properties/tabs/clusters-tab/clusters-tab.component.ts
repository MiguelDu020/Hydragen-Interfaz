import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-clusters-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="clusters-tab">
      <div class="cluster-item" *ngFor="let cluster of clusters; let i = index; trackBy: trackByIndex">
        <div class="cluster-header">
          <span class="cluster-title">Cluster {{ i + 1 }}</span>
          <button class="btn-remove" (click)="removeCluster(i)" [disabled]="clusters.length <= 1" title="Eliminar">✕</button>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Nombre</label>
            <input type="text" [(ngModel)]="cluster.cluster" (ngModelChange)="emit()" placeholder="cluster1" />
          </div>
          <div class="field">
            <label>Namespace</label>
            <input type="text" [(ngModel)]="cluster.namespace" (ngModelChange)="emit()" placeholder="default" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Réplicas</label>
            <input type="number" min="1" [(ngModel)]="cluster.replicas" (ngModelChange)="emit()" />
          </div>
          <div class="field">
            <label>Nodo (opcional)</label>
            <input type="text" [(ngModel)]="cluster.node" (ngModelChange)="emit()" placeholder="" />
          </div>
        </div>
      </div>

      <button class="btn-add" (click)="addCluster()">+ Agregar Cluster</button>
    </div>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;
    .clusters-tab { display: flex; flex-direction: column; gap: 12px; }
    .cluster-item {
      background: $bg-surface; border: 1px solid $border-color; border-radius: 8px; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .cluster-header {
      display: flex; justify-content: space-between; align-items: center;
      .cluster-title { font-size: 12px; font-weight: 600; color: $text-primary; }
    }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .field { display: flex; flex-direction: column; gap: 4px;
      label { font-size: 11px; color: $text-secondary; }
      input { width: 100%; }
    }
    .btn-remove {
      background: transparent; border: 1px solid $danger; color: $danger; padding: 2px 8px;
      border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.15s;
      &:hover:not(:disabled) { background: $danger; color: white; }
      &:disabled { opacity: 0.3; cursor: not-allowed; }
    }
    .btn-add {
      background: transparent; border: 1px dashed $border-color; color: $text-secondary;
      padding: 8px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s;
      &:hover { border-color: $accent-blue; color: $accent-blue; }
    }
  `]
})
export class ClustersTabComponent implements OnChanges {
  @Input() nodeData: any = {};
  @Output() dataChange = new EventEmitter<any>();

  clusters: any[] = [];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      const newClusters = this.nodeData.clusters || [{ cluster: 'cluster1', replicas: 1, namespace: 'default', node: '' }];
      // Solo actualizar si la longitud cambió o si es la primera carga.
      // Si solo cambiaron valores internos, ngModel se encarga y evitamos reasignar el array para no perder foco.
      if (this.clusters.length !== newClusters.length || JSON.stringify(this.clusters) !== JSON.stringify(newClusters)) {
        this.clusters = JSON.parse(JSON.stringify(newClusters));
      }
    }
  }

  addCluster() {
    this.clusters = [...this.clusters, { cluster: 'cluster1', replicas: 1, namespace: 'default', node: '' }];
    this.emit();
  }

  removeCluster(i: number) {
    if (this.clusters.length <= 1) return;
    this.clusters = this.clusters.filter((_, idx) => idx !== i);
    this.emit();
  }

  emit() {
    this.dataChange.emit({ ...this.nodeData, clusters: JSON.parse(JSON.stringify(this.clusters)) });
  }

  trackByIndex(index: number) {
    return index;
  }
}
