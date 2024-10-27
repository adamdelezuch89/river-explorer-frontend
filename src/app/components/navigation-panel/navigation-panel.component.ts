import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-navigation-panel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, DragDropModule],
  template: `
    <div class="nav-panel" *ngIf="show">
      <h3>Navigate</h3>
      <div class="nav-list" cdkDropList (cdkDropListDropped)="onDrop($event)">
        <div class="nav-item" *ngFor="let point of points; let i = index" cdkDrag>
          <div class="drag-handle">⋮⋮</div>
          <div class="point-details">
            <div class="point-name">{{point.name}}</div>
          </div>
          <button mat-icon-button class="remove-button" (click)="onRemovePoint(i)">
            ✕
          </button>
        </div>
      </div>
      <div class="nav-actions">
        <button mat-raised-button color="primary" 
                [disabled]="points.length < 2"
                (click)="onNavigate()">
          Navigate
        </button>
      </div>
    </div>
  `,
  styles: [`
    .nav-panel {
      position: absolute;
      left: 20px;
      top: 20px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      z-index: 1000;
      width: 250px;
    }

    .nav-list {
      margin: 10px 0;
    }

    .nav-item {
      display: flex;
      align-items: center;
      padding: 10px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: move;
    }

    .drag-handle {
      color: #999;
      margin-right: 10px;
      cursor: move;
    }

    .point-details {
      flex: 1;
    }

    .point-name {
      color: #333;
    }

    .nav-actions {
      margin-top: 15px;
    }

    .remove-button {
      color: #999;
      min-width: 24px;
      height: 24px;
      line-height: 24px;
      padding: 0;
      font-size: 16px;
    }

    .remove-button:hover {
      color: #f44336;
    }
  `]
})
export class NavigationPanelComponent {
  @Input() show = false;
  @Input() points: Array<{name: string, point: any}> = [];
  @Output() navigate = new EventEmitter<void>();
  @Output() drop = new EventEmitter<CdkDragDrop<string[]>>();
  @Output() removePoint = new EventEmitter<number>();

  onNavigate() {
    this.navigate.emit();
  }

  onDrop(event: CdkDragDrop<string[]>) {
    this.drop.emit(event);
  }

  onRemovePoint(index: number) {
    this.removePoint.emit(index);
  }
}
