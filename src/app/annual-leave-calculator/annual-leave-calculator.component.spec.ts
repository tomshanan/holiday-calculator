import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnualLeaveCalculatorComponent } from './annual-leave-calculator.component';

describe('AnnualLeaveCalculatorComponent', () => {
  let component: AnnualLeaveCalculatorComponent;
  let fixture: ComponentFixture<AnnualLeaveCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnualLeaveCalculatorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AnnualLeaveCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
