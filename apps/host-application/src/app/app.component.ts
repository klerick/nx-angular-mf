import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TestSharedLibraryComponent } from '@nx-angular-mf/test-shared-library';

@Component({
  imports: [RouterModule, TestSharedLibraryComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'host-application';
}
