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
    </div>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .sidebar-container {
      width: 220px;
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
      &.single-item { grid-template-columns: 1fr; }
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
      &:hover { border-color: $accent-blue; background-color: rgba(0, 123, 255, 0.08); transform: translateY(-1px); }
      &:active { cursor: grabbing; transform: translateY(0); }
      .cube-icon { font-size: 22px; color: #c7d2e0; }
      .cube-label { font-size: 11px; font-weight: 500; color: $text-primary; text-align: center; }
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
      gap: 10px;
      font-size: 13px;
      &:hover { border-color: $accent-blue; background-color: rgba(0, 123, 255, 0.06); }
      &:active { cursor: grabbing; }
    }

    .item-icon {
      min-width: 28px;
      height: 22px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      &.to { border: 1px solid #3c5e6e; background: #1a3340; color: #7dd3fc; }
      &.rt { border: 1px solid #4e5e3c; background: #2a3318; color: #bef264; }
      &.fb { border: 1px solid #6e5a3c; background: #3a2e18; color: #fcd34d; }
    }

    .item-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      small { font-size: 10px; color: $text-secondary; }
    }

    .hint {
      font-size: 10px;
      color: $text-secondary;
      margin-top: 8px;
      line-height: 1.5;
      padding: 8px;
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      border: 1px solid $border-color;
      strong { color: $accent-blue; }
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
