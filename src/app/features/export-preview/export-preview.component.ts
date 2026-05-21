import { Component, OnInit, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExporterService } from '../../core/services/exporter.service';

@Component({
  selector: 'app-export-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-overlay" (click)="close()">
      <div class="preview-container" (click)="$event.stopPropagation()">
        <div class="preview-header">
          <h3>Export Preview</h3>
          <span class="format-label">JSON</span>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        <div class="preview-body">
          <pre *ngIf="!error">{{ content }}</pre>
          <div class="error-msg" *ngIf="error">{{ error }}</div>
        </div>
        <div class="preview-footer">
          <button class="btn-secondary" (click)="close()">Cancel</button>
          <button class="btn-primary" (click)="download()">
            ⬇ Download JSON
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use '../../../styles/variables' as *;

    .preview-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .preview-container {
      background: $bg-card;
      border: 1px solid $border-color;
      border-radius: 10px;
      width: 700px;
      max-width: 92vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    .preview-header {
      padding: 16px 20px;
      border-bottom: 1px solid $border-color;
      display: flex;
      align-items: center;
      gap: 16px;

      h3 { margin: 0; font-size: 15px; flex: 1; }

      .format-label {
        font-size: 12px;
        font-weight: 600;
        color: white;
        background: $accent-blue;
        padding: 5px 14px;
        border-radius: 5px;
        letter-spacing: 0.03em;
      }

      .close-btn {
        background: none;
        border: none;
        color: $text-secondary;
        font-size: 22px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        &:hover { color: $text-primary; }
      }
    }

    .preview-body {
      flex: 1;
      overflow: auto;
      padding: 16px 20px;

      pre {
        margin: 0;
        font-family: $font-mono;
        font-size: 12px;
        line-height: 1.6;
        color: var(--text-primary);
        white-space: pre-wrap;
        word-break: break-word;
      }
    }

    .error-msg {
      color: $danger;
      font-size: 13px;
      padding: 16px;
      background: rgba($danger, 0.1);
      border-radius: 6px;
      border: 1px solid rgba($danger, 0.2);
    }

    .preview-footer {
      padding: 12px 20px;
      border-top: 1px solid $border-color;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
  `]
})
export class ExportPreviewComponent implements OnInit {
  content = '';
  error = '';
  @Input() onClose?: () => void;

  constructor(
    private exporterService: ExporterService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.generate();
  }

  generate() {
    try {
      this.error = '';
      this.content = this.exporterService.exportToJson();
    } catch (e: any) {
      this.error = e?.message || 'Error generating config';
      this.content = '';
    }
    this.cdr.detectChanges();
  }

  download() {
    if (this.error) return;
    this.exporterService.downloadFile(this.content, 'hydragen-config.json', 'application/json');
  }

  close() {
    if (this.onClose) this.onClose();
  }
}
