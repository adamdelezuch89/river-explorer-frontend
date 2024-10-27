
// services/river.service.ts remains the same, but here it is for completeness:
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { River } from '../models/river.model';

@Injectable({
  providedIn: 'root'
})
export class RiverService {
  private apiUrl = 'http://localhost:8000/api/river-map';

  constructor(private http: HttpClient) {}

  getRivers(bounds: any, zoom: number): Observable<River[]> {
    const params = {
      min_x: bounds.getWest().toString(),
      min_y: bounds.getSouth().toString(),
      max_x: bounds.getEast().toString(),
      max_y: bounds.getNorth().toString(),
      zoom: zoom.toString()
    };

    return this.http.get<River[]>(this.apiUrl, { params });
  }
}