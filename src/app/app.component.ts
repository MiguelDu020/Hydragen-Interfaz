import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarComponent } from './shared/components/toolbar/toolbar.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { EditorComponent } from './features/editor/editor.component';
import { PropertiesPanelComponent } from './features/properties/properties-panel/properties-panel.component';
import { ExportPreviewComponent } from './features/export-preview/export-preview.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    SidebarComponent,
    EditorComponent,
    PropertiesPanelComponent,
    ExportPreviewComponent
  ],
  template: `
    <div class="app-layout">
      <app-toolbar 
        class="header"
        (openPreview)="showPreview = true"
      ></app-toolbar>
      
      <div class="main-content">
        <app-sidebar class="sidebar"></app-sidebar>
        
        <div class="editor-area">
           <app-editor></app-editor>
        </div>
        
        <app-properties-panel class="properties"></app-properties-panel>
      </div>

      <!-- Export Preview Modal -->
      <app-export-preview
        *ngIf="showPreview"
        [onClose]="closePreview.bind(this)"
      ></app-export-preview>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'hydragen-console';
  showPreview = false;

  constructor(private themeService: ThemeService) {}

  closePreview() {
    this.showPreview = false;
  }
}
