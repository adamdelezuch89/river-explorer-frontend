// components/map/map.component.ts
import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RiverService } from '../../services/river.service';
import { River } from '../../models/river.model';

declare var L: any;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-container">
      <div id="map"></div>
      <div *ngIf="nearestPoint" class="coordinates-display">
        {{ nearestPoint.riverName }}
      </div>
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
  `
})
export class MapComponent implements OnInit, OnDestroy {
  private map: any;
  private L: any;
  private riverLayers: any[] = [];
  private isBrowser: boolean;
  private highlightMarker: any;
  private mouseMoveDebounceTimeout: any;
  private riverPoints: Array<{point: any, riverName: string}> = [];
  
  nearestPoint: any = null;

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
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';
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

    this.map = this.L.map('map').setView([0, 0], 2);

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
    const visiblePoints = this.riverPoints.filter(({point}) => bounds.contains(point));

    for (const {point, riverName} of visiblePoints) {
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
}
