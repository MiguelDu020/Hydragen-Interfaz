import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sidebar-container">
      <div class="section-label">Components</div>
      <div class="components-grid single-item">
        <div class="cube-item" draggable="true" (dragstart)="onDragStart($event, 'service')">
          <span class="cube-icon">◉</span>
          <span class="cube-label">Service</span>
        </div>
      </div>

      <div class="section-label mt">Resilience Patterns</div>
      <div class="item pattern" draggable="true" (dragstart)="onDragStart($event, 'fallback')">
        <span class="item-icon">FB</span>
        <div class="item-info">
          <span>Fallback</span>
          <small>Respuesta alternativa</small>
        </div>
      </div>
      <div class="item pattern" draggable="true" (dragstart)="onDragStart($event, 'bulkhead')">
        <span class="item-icon">BH</span>
        <div class="item-info">
          <span>Bulkhead</span>
          <small>Aislar fallas por recurso</small>
        </div>
      </div>
      <div class="item pattern" draggable="true" (dragstart)="onDragStart($event, 'loadshedding')">
        <span class="item-icon">LS</span>
        <div class="item-info">
          <span>Load Shedding</span>
          <small>Descartar carga excesiva</small>
        </div>
      </div>

      <p class="hint">Arrastra un patrón sobre un servicio para activarlo.</p>
    </div>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .sidebar-container {
      width: 240px;
      height: 100%;
      background-color: $bg-card;
      border-right: 1px solid $border-color;
      padding: 16px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: $text-secondary;
      margin-bottom: 4px;
      padding: 0 4px;

      &.mt { margin-top: 14px; }
    }

    .components-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 8px;
    }

    .components-grid.single-item {
      grid-template-columns: 1fr;
    }

    .cube-item {
      background-color: $bg-surface;
      border: 1px solid $border-color;
      border-radius: 8px;
      cursor: grab;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      gap: 8px;

      &:hover {
        border-color: $accent-blue;
        background-color: rgba($accent-blue, 0.08);
        transform: translateY(-1px);
      }

      &:active {
        cursor: grabbing;
        transform: translateY(0);
      }

      .cube-icon {
        font-size: 22px;
        color: #c7d2e0;
      }

      .cube-label {
        font-size: 11px;
        font-weight: 500;
        color: $text-primary;
        text-align: center;
      }
    }

    .item {
      padding: 10px 12px;
      background-color: $bg-surface;
      border: 1px solid $border-color;
      border-radius: 6px;
      cursor: grab;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;

      &:hover {
        border-color: $accent-blue;
        background-color: rgba($accent-blue, 0.06);
      }

      &:active { cursor: grabbing; }

      .item-icon {
        min-width: 28px;
        height: 22px;
        border-radius: 4px;
        border: 1px solid #3c4e67;
        background: #1d2a3a;
        color: #9cc8ff;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .item-info {
        display: flex;
        flex-direction: column;
        gap: 2px;

        small { font-size: 10px; color: $text-secondary; }
      }
    }

    .hint {
      font-size: 10px;
      color: $text-secondary;
      margin-top: 4px;
      line-height: 1.4;
      padding: 0 4px;
    }
  `]
})
export class SidebarComponent {
  onDragStart(event: DragEvent, type: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('type', type);
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
}
