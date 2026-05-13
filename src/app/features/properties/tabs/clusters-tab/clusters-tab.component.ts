import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphService } from '../../../../core/services/graph.service';

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
            <input type="text" [(ngModel)]="cluster.cluster" (ngModelChange)="emit()" placeholder="cluster1" list="existing-clusters" />
          </div>
          <div class="field">
            <label>Namespace</label>
            <input type="text" [(ngModel)]="cluster.namespace" (ngModelChange)="emit()" placeholder="default" list="existing-namespaces" />
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

      <!-- Datalists for suggestions -->
      <datalist id="existing-clusters">
        <option *ngFor="let name of existingClusters" [value]="name"></option>
      </datalist>
      <datalist id="existing-namespaces">
        <option *ngFor="let ns of existingNamespaces" [value]="ns"></option>
      </datalist>
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
  existingClusters: string[] = [];
  existingNamespaces: string[] = [];

  constructor(private graphService: GraphService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['nodeData'] && this.nodeData) {
      const newClusters = this.nodeData.clusters || [{ cluster: 'cluster1', replicas: 1, namespace: 'default', node: '' }];
      if (this.clusters.length !== newClusters.length || JSON.stringify(this.clusters) !== JSON.stringify(newClusters)) {
        this.clusters = JSON.parse(JSON.stringify(newClusters));
      }
      this.refreshSuggestions();
    }
  }

  refreshSuggestions() {
    const graph = this.graphService.getGraph();
    if (!graph) return;

    const clusterSet = new Set<string>();
    const namespaceSet = new Set<string>();

    graph.getNodes().forEach(node => {
      const data = node.getData() || {};
      const nodeClusters = data.clusters || [];
      nodeClusters.forEach((c: any) => {
        if (c.cluster) clusterSet.add(c.cluster);
        if (c.namespace) namespaceSet.add(c.namespace);
      });
    });

    this.existingClusters = Array.from(clusterSet).sort();
    this.existingNamespaces = Array.from(namespaceSet).sort();
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
