// components/map/map.component.ts
import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RiverService } from '../../services/river.service';
import { River } from '../../models/river.model';

// Declare leaflet as any to avoid type errors during SSR
declare var L: any;

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="map-container">
      <div id="map"></div>
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

    :host ::ng-deep .leaflet-popup-content-wrapper {
      border-radius: 4px;
    }
  `
})
export class MapComponent implements OnInit, OnDestroy {
    private map: any;
    private riverLayers: any[] = [];
    private L: any;
    private isBrowser: boolean;

    constructor(
        private riverService: RiverService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    async ngOnInit() {
        if (this.isBrowser) {
            // Dynamically import Leaflet only in browser
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
        // Fix Leaflet default icon path
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
    }

    private setupMapEvents(): void {
        const debouncedFetch = this.debounce(() => this.fetchRivers(), 300);
        this.map.on('moveend', debouncedFetch);
    }

    private fetchRivers(): void {
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();

        this.riverService.getRivers(bounds, zoom).subscribe({
            next: (rivers: River[]) => {
                this.clearRiverLayers();
                this.addRiversToMap(rivers);
            },
            error: (error) => console.error('Error fetching river data:', error)
        });
    }

    private clearRiverLayers(): void {
        this.riverLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.riverLayers = [];
    }

    private addRiversToMap(rivers: River[]): void {
        rivers.forEach(river => {
            const geojson = JSON.parse(river.geometry);
            const layer = this.L.geoJSON(geojson, {
                onEachFeature: (feature: any, layer: any) => {
                    layer.bindTooltip(river.name);
                }
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
