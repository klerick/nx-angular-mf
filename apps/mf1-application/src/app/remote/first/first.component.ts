import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TestSharedLibraryComponent } from '@nx-angular-mf/test-shared-library';

@Component({
  selector: 'app-first',
  imports: [TestSharedLibraryComponent],
  templateUrl: './first.component.html',
  styleUrl: './first.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstComponent {}
