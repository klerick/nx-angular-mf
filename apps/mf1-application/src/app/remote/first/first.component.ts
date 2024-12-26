import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestSharedLibraryComponent } from '@nx-angular-mf/test-shared-library';

@Component({
  selector: 'app-first',
  imports: [CommonModule, TestSharedLibraryComponent],
  templateUrl: './first.component.html',
  styleUrl: './first.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstComponent {}
