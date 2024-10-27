// components/map/map.component.ts
import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RiverService } from '../../services/river.service';
import { River } from '../../models/river.model';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NavigationPanelComponent } from '../navigation-panel/navigation-panel.component';

declare var L: any;

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [
        CommonModule,
        MatMenuModule,
        MatButtonModule,
        FormsModule,
        DragDropModule,
        NavigationPanelComponent  // Add this
    ],
    template: `
    <div class="map-container">
      <app-navigation-panel
        [show]="showNavPanel"
        [points]="navigationPoints"
        (navigate)="navigate()"
        (drop)="drop($event)"
        (removePoint)="removePoint($event)">
      </app-navigation-panel>

      <div id="map"></div>
      <div *ngIf="nearestPoint" class="coordinates-display">
        {{ nearestPoint.riverName }}
      </div>
      
      <!-- Modified menu trigger -->
      <button mat-button style="display: none;" [matMenuTriggerFor]="menu" #menuTrigger="matMenuTrigger">
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="planRouteFrom()">Plan a route from this point</button>
        <button mat-menu-item 
                *ngIf="navigationPoints.length >= 2" 
                (click)="navigateBy()">
          Navigate by this point
        </button>
        <button mat-menu-item (click)="planRouteTo()">Plan a route to this point</button>

      </mat-menu>
    </div>
  `,
    styles: `
    .map-container {
      position: absolute;
      top: 64px;
      bottom: 0;
      left: 0;
      right: 0;
    }

    #map {
      height: 100%;
      width: 100%;
    }

    .coordinates-display {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.9);
      padding: 8px 16px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      z-index: 1000;
    }

    :host ::ng-deep .leaflet-popup-content-wrapper {
      border-radius: 4px;
    }

    .point-menu {
      position: absolute;
      z-index: 1000;
    }

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

    .nav-form {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .form-group label {
      font-weight: 500;
      color: #666;
    }

    .form-group input {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #f5f5f5;
    }

    button {
      margin-top: 10px;
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

    .nav-item:last-child {
      margin-bottom: 0;
    }

    .drag-handle {
      color: #999;
      margin-right: 10px;
      cursor: move;
    }

    .point-details {
      flex: 1;
    }

    .point-label {
      font-weight: 500;
      color: #666;
      font-size: 0.9em;
    }

    .point-name {
      color: #333;
    }

    .nav-actions {
      margin-top: 15px;
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 4px;
      box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
                  0 8px 10px 1px rgba(0, 0, 0, 0.14),
                  0 3px 14px 2px rgba(0, 0, 0, 0.12);
    }

    .cdk-drag-placeholder {
      opacity: 0;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .nav-list.cdk-drop-list-dragging .nav-item:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `
})
export class MapComponent implements OnInit, OnDestroy {
    private map: any;
    private L: any;
    private riverLayers: any[] = [];
    private isBrowser: boolean;
    private highlightMarker: any;
    private mouseMoveDebounceTimeout: any;
    private riverPoints: Array<{ point: any, riverName: string }> = [];
    // Add these two properties
    private markers: any[] = [];  // Replace fromMarker and toMarker with an array

    nearestPoint: any = null;

    showMenu = false;
    menuPosition = { x: 0, y: 0 };
    selectedPoint: any = null;

    @ViewChild('menuTrigger') menuTrigger: any;

    showNavPanel = false;
    navigation = {
        points: [] as any[]  // Will store the same data as navigationPoints but in a different format if needed
    };

    navigationPoints: Array<{ name: string, point: any }> = [];

    constructor(
        private riverService: RiverService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    async ngOnInit() {
        if (this.isBrowser) {
            const leaflet = await import('leaflet');
            this.L = leaflet.default;
            this.initializeMap();
            this.setupMapEvents();
            this.fetchRivers();
        }
    }

    ngOnDestroy() {
        if (this.isBrowser && this.map) {
            this.map.remove();
        }
    }

    private initializeMap(): void {
        // Update these paths to include the full path from assets
        const iconRetinaUrl = './assets/marker-icon-2x.png';
        const iconUrl = './assets/marker-icon.png';
        const shadowUrl = './assets/marker-shadow.png';
        const iconDefault = this.L.icon({
            iconRetinaUrl,
            iconUrl,
            shadowUrl,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41]
        });
        this.L.Marker.prototype.options.icon = iconDefault;

        this.map = this.L.map('map', {
            zoomControl: false
        }).setView([52.0, 19.0], 6
        );

        this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Create a single reusable marker
        this.highlightMarker = this.L.circleMarker([0, 0], {
            radius: 5,
            fillColor: '#ffffff',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Add mousemove event listener
        this.map.on('mousemove', this.debounce((e: any) => this.handleMouseMove(e), 50));

        // Add click event listener
        this.map.on('click', (e: any) => this.handleMapClick(e));
    }

    private setupMapEvents(): void {
        const debouncedFetch = this.debounce(() => this.fetchRivers(), 300);
        this.map.on('moveend', debouncedFetch);
    }

    private handleMouseMove(e: any): void {
        if (!this.riverPoints.length) return;

        const mousePoint = this.map.latLngToContainerPoint(e.latlng);
        const bounds = this.map.getBounds();
        let nearestPoint = null;
        let minDistance = Infinity;
        let nearestRiverName = '';

        // Only check points within current viewport
        const visiblePoints = this.riverPoints.filter(({ point }) => bounds.contains(point));

        for (const { point, riverName } of visiblePoints) {
            const pointOnMap = this.map.latLngToContainerPoint(point);
            // Simplified distance calculation
            const dx = mousePoint.x - pointOnMap.x;
            const dy = mousePoint.y - pointOnMap.y;
            const distance = dx * dx + dy * dy; // Square of distance is sufficient for comparison

            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
                nearestRiverName = riverName;
            }
        }

        // Use square of pixel distance (50 * 50 = 2500)
        if (minDistance < 2500 && nearestPoint) {
            this.updateNearestPointMarker(nearestPoint, nearestRiverName);
        } else {
            this.removeNearestPointMarker();
        }
    }

    private updateNearestPointMarker(point: any, riverName: string): void {
        if (!this.map.hasLayer(this.highlightMarker)) {
            this.highlightMarker.addTo(this.map);
        }
        this.highlightMarker.setLatLng(point);
        this.nearestPoint = { riverName };
    }

    private removeNearestPointMarker(): void {
        if (this.map.hasLayer(this.highlightMarker)) {
            this.highlightMarker.remove();
        }
        this.nearestPoint = null;
    }

    private fetchRivers(): void {
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();

        this.riverService.getRivers(bounds, zoom).subscribe({
            next: (rivers: River[]) => {
                this.clearRiverLayers();
                this.addRiversToMap(rivers);
                this.extractRiverPoints(rivers);
            },
            error: (error) => console.error('Error fetching river data:', error)
        });
    }

    private extractRiverPoints(rivers: River[]): void {
        this.riverPoints = [];
        rivers.forEach(river => {
            const geojson = JSON.parse(river.geometry);
            if (geojson.type === 'LineString') {
                geojson.coordinates.forEach((coord: number[]) => {
                    this.riverPoints.push({
                        point: this.L.latLng(coord[1], coord[0]),
                        riverName: river.name
                    });
                });
            } else if (geojson.type === 'MultiLineString') {
                geojson.coordinates.forEach((line: number[][]) => {
                    line.forEach((coord: number[]) => {
                        this.riverPoints.push({
                            point: this.L.latLng(coord[1], coord[0]),
                            riverName: river.name
                        });
                    });
                });
            }
        });
    }

    private clearRiverLayers(): void {
        this.riverLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.riverLayers = [];
        this.riverPoints = [];
        this.removeNearestPointMarker();
    }

    private addRiversToMap(rivers: River[]): void {
        rivers.forEach(river => {
            const geojson = JSON.parse(river.geometry);
            const layer = this.L.geoJSON(geojson, {
                style: {
                    color: '#3388ff',
                    weight: 3,
                    opacity: 0.8
                },

            }).addTo(this.map);
            this.riverLayers.push(layer);
        });
    }

    private debounce(func: Function, wait: number): (...args: any[]) => void {
        let timeout: any;
        return (...args: any[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    private handleMapClick(e: any): void {
        if (!this.nearestPoint) return; // Only proceed if a point is highlighted

        const containerPoint = this.map.latLngToContainerPoint(this.highlightMarker.getLatLng());
        setTimeout(() => {
            this.menuTrigger.menuData = { point: this.highlightMarker.getLatLng() };
            this.menuTrigger.openMenu();

            // Position the menu at bottom right of the highlighted point
            const menuElement = document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
            if (menuElement) {
                menuElement.style.position = 'absolute';
                menuElement.style.left = `${containerPoint.x + 0}px`;
                menuElement.style.top = `${containerPoint.y + 55}px`;
            }
        });
    }

    planRouteFrom(): void {
        const point = this.menuTrigger.menuData.point;
        this.showNavPanel = true;
        this.menuTrigger.closeMenu();

        // Replace first point or add if empty
        if (this.navigationPoints.length > 1) {
            this.navigationPoints[0] = {
                name: this.nearestPoint.riverName,
                point
            };
        } else {
            this.navigationPoints.push({
                name: this.nearestPoint.riverName,
                point
            });
        }

        this.updateMarkers();
    }

    planRouteTo(): void {
        const point = this.menuTrigger.menuData.point;
        this.showNavPanel = true;
        this.menuTrigger.closeMenu();

        // Replace last point or add if empty
        if (this.navigationPoints.length > 1) {
            this.navigationPoints[this.navigationPoints.length - 1] = {
                name: this.nearestPoint.riverName,
                point
            };
        } else {
            this.navigationPoints.push({
                name: this.nearestPoint.riverName,
                point
            });
        }

        this.updateMarkers();
    }

    private updateMarkers(): void {
        // Remove all existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        // Add new markers for each point
        this.navigationPoints.forEach((navPoint, index) => {
            const marker = this.L.marker(navPoint.point, { draggable: true })
                .addTo(this.map)
                .bindPopup(`Point ${index + 1}: ${navPoint.name}`);
            this.markers.push(marker);
        });
    }

    navigate(): void {
        // Create a formatted string of all navigation points
        const routeDescription = this.navigationPoints
            .map((point, index) =>
                `Point ${index + 1}: ${point.name}\n` +
                `Latitude: ${point.point.lat.toFixed(6)}, Longitude: ${point.point.lng.toFixed(6)}`
            )
            .join('\n\n');

        alert(`Navigation coordinates:\n\n${routeDescription}`);
    }

    drop(event: CdkDragDrop<string[]>) {
        moveItemInArray(this.navigationPoints, event.previousIndex, event.currentIndex);
        this.updateMarkers();
    }

    navigateBy(): void {
        const point = this.menuTrigger.menuData.point;
        this.menuTrigger.closeMenu();

        // Insert the new point between start and end points
        this.navigationPoints.splice(this.navigationPoints.length - 1, 0, {
            name: this.nearestPoint.riverName,
            point
        });

        this.updateMarkers();
    }

    removePoint(index: number): void {
        this.navigationPoints.splice(index, 1);
        this.updateMarkers();
        
        // Hide panel if no points left
        if (this.navigationPoints.length === 0) {
            this.showNavPanel = false;
        }
    }
}
