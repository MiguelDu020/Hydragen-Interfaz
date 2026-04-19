import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    .modal-content {
      background: $bg-card;
      border: 1px solid $border-color;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid $border-color;
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 { margin: 0; font-size: 16px; }
      
      .close-btn {
        background: none;
        border: none;
        color: $text-secondary;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        
        &:hover { color: $text-primary; }
      }
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
    }
  `]
})
export class ModalComponent {
  @Input() title: string = '';
  @Input() isOpen: boolean = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  close() {
    this.isOpen = false;
    this.isOpenChange.emit(this.isOpen);
  }
}
