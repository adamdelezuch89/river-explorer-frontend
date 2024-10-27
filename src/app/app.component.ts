import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { TopToolbarComponent } from './components/top-toolbar/top-toolbar.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MapComponent, TopToolbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'river-explorer';
}
