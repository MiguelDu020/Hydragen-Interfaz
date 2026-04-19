import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Node } from '@antv/x6';
import { GlobalSettings, ClusterLatency } from '../../../core/models/hydragen.model';
import { GraphService } from '../../../core/services/graph.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel-container" *ngIf="selectedNode; else globalSettingsTemplate">
      <div class="header">
        <h3>Service Properties</h3>
        <span class="node-id">{{ selectedNode.id.substring(0,8) }}</span>
      </div>

      <div class="tabs">
        <button [class.active]="activeTab === 'general'" (click)="activeTab = 'general'">General</button>
        <button [class.active]="activeTab === 'clusters'" (click)="activeTab = 'clusters'">Clusters</button>
        <button [class.active]="activeTab === 'resources'" (click)="activeTab = 'resources'">Resources</button>
        <button [class.active]="activeTab === 'endpoints'" (click)="activeTab = 'endpoints'">Endpoints</button>
        <button [class.active]="activeTab === 'resilience'" (click)="activeTab = 'resilience'">Resilience</button>
      </div>

      <div class="tab-content">
        <ng-container [ngSwitch]="activeTab">
          <div *ngSwitchCase="'general'">
            <div class="field">
              <label>Service Name</label>
              <input type="text" [value]="nodeData?.name || ''" (input)="updateData('name', $event)" />
            </div>
            <div class="field">
              <label>Protocol</label>
              <select [value]="nodeData?.protocol || 'http'" (change)="updateData('protocol', $event)">
                <option value="http">HTTP</option>
                <option value="grpc">gRPC</option>
              </select>
            </div>
            <div class="field">
              <label>Processes</label>
              <input type="number" [value]="nodeData?.processes || 0" (input)="updateData('processes', $event)" />
            </div>
            <div class="field">
              <label>Readiness Probe (seconds)</label>
              <input type="number" [value]="nodeData?.readiness_probe || 1" (input)="updateData('readiness_probe', $event)" />
            </div>
            <div class="field checkbox-field">
              <label>
                <input type="checkbox" [checked]="nodeData?.logging" (change)="updateData('logging', $event, true)" /> Enable Logging
              </label>
            </div>
            <div class="field checkbox-field">
              <label>
                <input type="checkbox" [checked]="nodeData?.development" (change)="updateData('development', $event, true)" /> Development Mode
              </label>
            </div>
            <div class="field">
              <label>Base Image</label>
              <input type="text" [value]="nodeData?.base_image || 'ubuntu:20.04'" (input)="updateData('base_image', $event)" />
            </div>
          </div>

          <div *ngSwitchCase="'clusters'">
            <p class="help-text">Define one or more clusters for this service.</p>
            <div class="list-group">
              <div class="list-item" *ngFor="let cluster of nodeData?.clusters || []; let i = index">
                <div class="field inline">
                  <label>Cluster Name</label>
                  <input type="text" [value]="cluster.cluster" (input)="updateNested('clusters.' + i + '.cluster', $event)" />
                </div>
                <div class="field inline">
                  <label>Replicas</label>
                  <input type="number" [value]="cluster.replicas" (input)="updateNested('clusters.' + i + '.replicas', $event)" />
                </div>
                <div class="field inline">
                  <label>Namespace</label>
                  <input type="text" [value]="cluster.namespace" (input)="updateNested('clusters.' + i + '.namespace', $event)" />
                </div>
                <div class="field inline">
                  <label>Node</label>
                  <input type="text" [value]="cluster.node" (input)="updateNested('clusters.' + i + '.node', $event)" />
                </div>
                <button class="btn-remove" (click)="removeCluster(i)">Remove cluster</button>
              </div>
            </div>
            <button class="btn-add" (click)="addCluster()">Add Cluster</button>
          </div>

          <div *ngSwitchCase="'resources'">
            <p class="help-text">Set resource requests and limits for the selected service.</p>
            <div class="field inline">
              <label>CPU Request</label>
              <input type="text" [value]="getNested('resources.requests.cpu') || ''" (input)="updateNested('resources.requests.cpu', $event)" />
            </div>
            <div class="field inline">
              <label>Memory Request</label>
              <input type="text" [value]="getNested('resources.requests.memory') || ''" (input)="updateNested('resources.requests.memory', $event)" />
            </div>
            <div class="field inline">
              <label>CPU Limit</label>
              <input type="text" [value]="getNested('resources.limits.cpu') || ''" (input)="updateNested('resources.limits.cpu', $event)" />
            </div>
            <div class="field inline">
              <label>Memory Limit</label>
              <input type="text" [value]="getNested('resources.limits.memory') || ''" (input)="updateNested('resources.limits.memory', $event)" />
            </div>
          </div>

          <div *ngSwitchCase="'endpoints'">
            <p class="help-text">Create and manage endpoint behavior, CPU complexity, and service calls.</p>
            <div class="list-group">
              <div class="list-item" *ngFor="let endpoint of nodeData?.endpoints || []; let ei = index">
                <div class="field inline">
                  <label>Endpoint Name</label>
                  <input type="text" [value]="endpoint.name" (input)="updateNested('endpoints.' + ei + '.name', $event)" />
                </div>
                <div class="field inline">
                  <label>Execution Mode</label>
                  <select [value]="endpoint.execution_mode" (change)="updateNested('endpoints.' + ei + '.execution_mode', $event)">
                    <option value="sequential">Sequential</option>
                    <option value="parallel">Parallel</option>
                  </select>
                </div>
                <div class="field inline">
                  <label>Execution Time</label>
                  <input type="number" step="0.1" [value]="endpoint.cpu_complexity?.execution_time" (input)="updateNested('endpoints.' + ei + '.cpu_complexity.execution_time', $event)" />
                </div>
                <div class="field inline">
                  <label>Threads</label>
                  <input type="number" [value]="endpoint.cpu_complexity?.threads" (input)="updateNested('endpoints.' + ei + '.cpu_complexity.threads', $event)" />
                </div>
                <div class="field inline">
                  <label>Forward Requests</label>
                  <select [value]="endpoint.network_complexity?.forward_requests" (change)="updateNested('endpoints.' + ei + '.network_complexity.forward_requests', $event)">
                    <option value="synchronous">Synchronous</option>
                    <option value="asynchronous">Asynchronous</option>
                  </select>
                </div>
                <div class="field inline">
                  <label>Payload Size</label>
                  <input type="number" [value]="endpoint.network_complexity?.response_payload_size" (input)="updateNested('endpoints.' + ei + '.network_complexity.response_payload_size', $event)" />
                </div>
                <div class="subsection">
                  <h4>Called Services</h4>
                  <div class="sub-list" *ngFor="let call of endpoint.network_complexity?.called_services || []; let ci = index">
                    <div class="field inline">
                      <label>Service Name</label>
                      <input type="text" [value]="call.service" (input)="updateNested('endpoints.' + ei + '.network_complexity.called_services.' + ci + '.service', $event)" />
                    </div>
                    <div class="field inline">
                      <label>Endpoint</label>
                      <input type="text" [value]="call.endpoint" (input)="updateNested('endpoints.' + ei + '.network_complexity.called_services.' + ci + '.endpoint', $event)" />
                    </div>
                    <div class="field inline">
                      <label>Port</label>
                      <input type="text" [value]="call.port" (input)="updateNested('endpoints.' + ei + '.network_complexity.called_services.' + ci + '.port', $event)" />
                    </div>
                    <div class="field inline">
                      <label>Protocol</label>
                      <select [value]="call.protocol" (change)="updateNested('endpoints.' + ei + '.network_complexity.called_services.' + ci + '.protocol', $event)">
                        <option value="http">HTTP</option>
                        <option value="grpc">gRPC</option>
                      </select>
                    </div>
                    <div class="field inline">
                      <label>Traffic Ratio</label>
                      <input type="number" step="0.1" [value]="call.traffic_forward_ratio" (input)="updateNested('endpoints.' + ei + '.network_complexity.called_services.' + ci + '.traffic_forward_ratio', $event)" />
                    </div>
                    <div class="field inline">
                      <label>Request Payload</label>
                      <input type="number" [value]="call.request_payload_size" (input)="updateNested('endpoints.' + ei + '.network_complexity.called_services.' + ci + '.request_payload_size', $event)" />
                    </div>
                    <button class="btn-remove" (click)="removeCalledService(ei, ci)">Remove call</button>
                  </div>
                  <button class="btn-add" (click)="addCalledService(ei)">Add Called Service</button>
                </div>
                <button class="btn-remove" (click)="removeEndpoint(ei)">Remove endpoint</button>
              </div>
            </div>
            <button class="btn-add" (click)="addEndpoint()">Add Endpoint</button>
          </div>

          <div *ngSwitchCase="'resilience'">
            <p class="help-text">Activate resilience patterns to include them in the exported configuration.</p>
            <div class="field checkbox-field">
              <label>
                <input type="checkbox" [checked]="getNested('resilience_patterns.bulkhead.enabled')" (change)="updateNested('resilience_patterns.bulkhead.enabled', $event, true)" /> Bulkhead Enabled
              </label>
            </div>
            <div class="field checkbox-field">
              <label>
                <input type="checkbox" [checked]="getNested('resilience_patterns.fallback.enabled')" (change)="updateNested('resilience_patterns.fallback.enabled', $event, true)" /> Fallback Enabled
              </label>
            </div>
            <div class="field checkbox-field">
              <label>
                <input type="checkbox" [checked]="getNested('resilience_patterns.load_shedding.enabled')" (change)="updateNested('resilience_patterns.load_shedding.enabled', $event, true)" /> Load Shedding Enabled
              </label>
            </div>
          </div>
        </ng-container>
      </div>
    </div>

    <ng-template #globalSettingsTemplate>
      <div class="panel-container">
        <div class="header">
          <h3>Global Settings</h3>
          <span class="node-id">Root configuration</span>
        </div>
        <div class="tab-content">
          <p class="help-text">Click blank canvas to edit global HydraGen settings.</p>
          <div class="field checkbox-field">
            <label>
              <input type="checkbox" [checked]="settings.logging" (change)="updateGlobalSetting('logging', $event, true)" /> Enable Logging
            </label>
          </div>
          <div class="field checkbox-field">
            <label>
              <input type="checkbox" [checked]="settings.development" (change)="updateGlobalSetting('development', $event, true)" /> Development Mode
            </label>
          </div>
          <div class="field">
            <label>Base Image</label>
            <input type="text" [value]="settings.base_image" (input)="updateGlobalSetting('base_image', $event)" />
          </div>
          <div class="help-text">Optional cluster latencies can be used for performance modeling.</div>
          <div class="list-group">
            <div class="list-item" *ngFor="let latency of clusterLatencies || []; let i = index">
              <div class="field inline">
                <label>Source</label>
                <input type="text" [value]="latency.src" (input)="updateLatency(i, 'src', $event)" />
              </div>
              <div class="field inline">
                <label>Destination</label>
                <input type="text" [value]="latency.dest" (input)="updateLatency(i, 'dest', $event)" />
              </div>
              <div class="field inline">
                <label>Latency (ms)</label>
                <input type="number" [value]="latency.latency" (input)="updateLatency(i, 'latency', $event)" />
              </div>
              <button class="btn-remove" (click)="removeLatency(i)">Remove latency</button>
            </div>
          </div>
          <button class="btn-add" (click)="addLatency()">Add Latency</button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;
    
    .panel-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      padding: 16px;
      border-bottom: 1px solid $border-color;
      display: flex;
      justify-content: space-between;
      h3 { margin: 0; font-size: 16px; font-weight: 500; }
      .node-id { color: $text-secondary; font-size: 12px; }
    }
    
    .tabs {
      display: flex;
      border-bottom: 1px solid $border-color;
      overflow-x: auto;
      
      button {
        flex: 1;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: $text-secondary;
        padding: 10px 4px;
        font-size: 12px;
        border-radius: 0;
        
        &.active {
          color: $accent-blue;
          border-bottom-color: $accent-blue;
        }
      }
    }
    
    .tab-content {
      padding: 16px;
      flex: 1;
      overflow-y: auto;
    }
    
    .field {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      
      label { font-size: 12px; color: $text-secondary; display: flex; align-items: center; gap: 6px; }
      input[type="text"], input[type="number"], select { width: 100%; }
      input[type="checkbox"] { width: auto; }
    }
    
    .empty-state {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $text-secondary;
      font-size: 14px;
    }
  `]
})
export class PropertiesPanelComponent implements OnInit {
  selectedNode: Node | null = null;
  nodeData: any = {};
  activeTab = 'general';
  settings: GlobalSettings = { logging: false, development: false, base_image: 'ubuntu:20.04' };
  clusterLatencies: ClusterLatency[] = [];

  constructor(private graphService: GraphService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.settings = this.graphService.getSettings();
    this.clusterLatencies = this.graphService.getClusterLatencies();

    this.graphService.nodeSelected$.subscribe((node: any) => {
      this.selectedNode = node;
      if (node) {
        this.nodeData = { ...node.getData() } || {};
      } else {
        this.nodeData = {};
        this.settings = this.graphService.getSettings();
        this.clusterLatencies = this.graphService.getClusterLatencies();
      }
      this.activeTab = 'general';
      this.cdr.detectChanges();
    });
  }

  setNodeData(data: any) {
    if (!this.selectedNode) return;
    this.selectedNode.setData(data);
    this.nodeData = data;
    this.refreshNodeVisuals();
  }

  refreshNodeVisuals() {
    if (!this.selectedNode) return;
    const data = this.nodeData || {};
    this.selectedNode.attr({
      title: { text: data.name || 'Service' },
      badge: { text: (data.protocol || 'http').toUpperCase() },
      line1: { text: `⚡ ${data.resources?.limits?.cpu || '1000m'} / ${data.resources?.requests?.cpu || '500m'}` },
      line2: { text: `🔁 ${data.clusters?.[0]?.replicas ?? 1} | 📦 ${data.clusters?.[0]?.cluster || 'cluster1'}` }
    });
  }

  getNested(path: string): any {
    const keys = path.split('.');
    let current = this.nodeData;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  parseValue(target: HTMLInputElement, isCheckbox = false) {
    if (isCheckbox) return target.checked;
    if (target.type === 'number') return target.value === '' ? undefined : Number(target.value);
    return target.value;
  }

  updateData(key: string, event: Event, isCheckbox = false) {
    if (!this.selectedNode) return;
    const target = event.target as HTMLInputElement;
    const value = this.parseValue(target, isCheckbox);
    const newData = { ...this.selectedNode.getData(), [key]: value };
    this.setNodeData(newData);
  }

  updateNested(path: string, event: Event, isCheckbox = false) {
    if (!this.selectedNode) return;
    const target = event.target as HTMLInputElement;
    const value = this.parseValue(target, isCheckbox);
    const keys = path.split('.');
    const newData = JSON.parse(JSON.stringify(this.selectedNode.getData() || {}));
    let current = newData;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      if (current[key] === undefined || current[key] === null) {
        current[key] = isNaN(Number(nextKey)) ? {} : [];
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    this.setNodeData(newData);
  }

  addCluster() {
    const clusters = this.nodeData.clusters || [];
    clusters.push({ cluster: 'cluster1', replicas: 1, namespace: 'default', node: '', annotations: {} });
    this.setNodeData({ ...this.nodeData, clusters });
  }

  removeCluster(index: number) {
    const clusters = [...(this.nodeData.clusters || [])];
    clusters.splice(index, 1);
    this.setNodeData({ ...this.nodeData, clusters });
  }

  addEndpoint() {
    const endpoints = this.nodeData.endpoints || [];
    endpoints.push({
      name: 'new-endpoint',
      execution_mode: 'sequential',
      cpu_complexity: { execution_time: 0.1, threads: 1 },
      network_complexity: { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] }
    });
    this.setNodeData({ ...this.nodeData, endpoints });
  }

  removeEndpoint(index: number) {
    const endpoints = [...(this.nodeData.endpoints || [])];
    endpoints.splice(index, 1);
    this.setNodeData({ ...this.nodeData, endpoints });
  }

  addCalledService(endpointIndex: number) {
    const endpoints = JSON.parse(JSON.stringify(this.nodeData.endpoints || []));
    const endpoint = endpoints[endpointIndex] || { network_complexity: { called_services: [] } };
    endpoint.network_complexity = endpoint.network_complexity || { forward_requests: 'synchronous', response_payload_size: 0, called_services: [] };
    endpoint.network_complexity.called_services = endpoint.network_complexity.called_services || [];
    endpoint.network_complexity.called_services.push({
      service: '',
      endpoint: '',
      port: '80',
      protocol: 'http',
      traffic_forward_ratio: 1,
      request_payload_size: 0
    });
    this.setNodeData({ ...this.nodeData, endpoints });
  }

  removeCalledService(endpointIndex: number, callIndex: number) {
    const endpoints = JSON.parse(JSON.stringify(this.nodeData.endpoints || []));
    const calledServices = endpoints[endpointIndex]?.network_complexity?.called_services || [];
    calledServices.splice(callIndex, 1);
    endpoints[endpointIndex].network_complexity.called_services = calledServices;
    this.setNodeData({ ...this.nodeData, endpoints });
  }

  updateGlobalSetting(key: keyof GlobalSettings, event: Event, isCheckbox = false) {
    const target = event.target as HTMLInputElement;
    const value = this.parseValue(target, isCheckbox);
    this.settings = { ...this.settings, [key]: value } as GlobalSettings;
    this.graphService.setSettings(this.settings);
  }

  updateLatency(index: number, field: keyof ClusterLatency, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = field === 'latency' ? Number(target.value) : target.value;
    const latencies = [...this.clusterLatencies];
    latencies[index] = { ...latencies[index], [field]: value } as ClusterLatency;
    this.clusterLatencies = latencies;
    this.graphService.setClusterLatencies(latencies);
  }

  addLatency() {
    const latencies = [...this.clusterLatencies, { src: '', dest: '', latency: 0 }];
    this.clusterLatencies = latencies;
    this.graphService.setClusterLatencies(latencies);
  }

  removeLatency(index: number) {
    const latencies = [...this.clusterLatencies];
    latencies.splice(index, 1);
    this.clusterLatencies = latencies;
    this.graphService.setClusterLatencies(latencies);
  }
}
