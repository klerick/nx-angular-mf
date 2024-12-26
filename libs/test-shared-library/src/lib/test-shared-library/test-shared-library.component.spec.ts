import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestSharedLibraryComponent } from './test-shared-library.component';

describe('TestSharedLibraryComponent', () => {
  let component: TestSharedLibraryComponent;
  let fixture: ComponentFixture<TestSharedLibraryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSharedLibraryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestSharedLibraryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
