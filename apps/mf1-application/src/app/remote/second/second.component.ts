import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-second',
  imports: [CommonModule],
  templateUrl: './second.component.html',
  styleUrl: './second.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecondComponent {}
