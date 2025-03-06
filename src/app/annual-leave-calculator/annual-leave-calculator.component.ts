// app/annual-leave-calculator/annual-leave-calculator.component.ts
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { CommentDialogComponent } from '../comment-dialog/comment-dialog.component';
import { ukBankHolidays } from './uk-bank-holidays';
import { isTheSameDay, isWeekend } from '../utils/date.utils';

interface DayInfo {
  date: Date;
  isSelected: boolean;
  isBankHoliday?: boolean;
  isWeekend: boolean;
  comment?: string;
  monthIndex: number; // For alternating month backgrounds
}

interface Week {
  days: DayInfo[];
  weekNumber: number;
  isFirstWeekOfMonth?: boolean;
}

@Component({
  selector: 'app-annual-leave-calculator',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './annual-leave-calculator.component.html',
  styleUrl: './annual-leave-calculator.component.scss',
})
export class AnnualLeaveCalculatorComponent implements OnInit {
  selectionMode: 'single' | 'range' | 'comment' = 'single';
  rangeStart: Date | null = null;
  tentativeEnd: Date | null = null;
  weeks: Week[] = [];
  leaveForm: FormGroup;
  totalLeaveDays = { totalAnnualLeave: 0, totalBankHolidaysTaken: 0, total: 0 }; // Total leave days selected

  // UK Bank Holidays for 2025 with names
  ukBankHolidays = ukBankHolidays;

  padStart = signal(0);
  padEnd = signal(0);
  startPadding = computed(() => Array(this.padStart()).fill('day'));
  endPadding = computed(() => Array(this.padEnd()).fill('day'));

  constructor(private dialog: MatDialog) {
    const savedState = this.loadState();

    const today = new Date();
    const startOfYear = savedState
      ? new Date(savedState.leaveForm.startDate)
      : new Date(today.getFullYear(), 3, 6);
    const endOfYear = savedState
      ? new Date(savedState.leaveForm.endDate)
      : new Date(today.getFullYear() + 1, 3, 5);

    this.leaveForm = new FormGroup({
      startDate: new FormControl<Date>(startOfYear),
      endDate: new FormControl<Date>(endOfYear),
    });

    if (savedState?.weeks) {
      this.weeks = savedState.weeks.map((week: Week) => ({
        ...week,
        days: week.days.map((day: DayInfo) => ({
          ...day,
          date: new Date(day.date),
        })),
      }));
    }
  }

  ngOnInit(): void {
    this.generateCalendar();

    // Subscribe to form changes
    this.leaveForm.get('startDate')?.valueChanges.subscribe(() => {
      this.generateCalendar();
    });

    this.leaveForm.get('endDate')?.valueChanges.subscribe(() => {
      this.generateCalendar();
    });
  }

  generateCalendar(): void {
    let selectedDates = this.weeks.flatMap((week) =>
      week.days.filter((day) => day.isSelected)
    );

    this.weeks = [];

    const startDate = new Date(this.leaveForm.get('startDate')?.value);
    const endDate = new Date(this.leaveForm.get('endDate')?.value);

    // Pad the start and end of the calendar UI with empty days
    this.padStart.set(startDate.getDay() === 0 ? 6 : startDate.getDay() - 1);
    this.padEnd.set(endDate.getDay() === 0 ? 0 : 7 - endDate.getDay());

    // Generate the weeks
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const week: Week = {
        days: [],
        weekNumber: this.getWeekNumber(currentDate),
      };

      // Generate the days for the current week
      while (
        (week.days.length === 0 || currentDate.getDay() !== 1) &&
        currentDate <= endDate
      ) {
        const matchingDay = selectedDates.find((selectedDay) =>
          isTheSameDay(selectedDay.date, currentDate)
        );
        if (matchingDay) {
          week.days.push({ ...matchingDay });
        } else {
          const monthIndex = currentDate.getMonth();

          week.days.push({
            date: new Date(currentDate),
            isSelected: false,
            isWeekend: isWeekend(currentDate),
            comment: undefined,
            monthIndex,
          });
        }

        // if it's monday, and previous week was a different month, mark it as first week of month
        if (
          currentDate.getDay() === 1 &&
          (this.weeks.length < 2 ||
            this.weeks
              .at(-1)
              ?.days.some(
                (day) => day.date.getMonth() !== currentDate.getMonth()
              ))
        ) {
          week.isFirstWeekOfMonth = true;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.weeks.push(week);
    }

    this.calculateTotalLeaveDays();
  }

  isPublicHoliday(date: Date): boolean {
    return this.ukBankHolidays.some(
      (holiday) =>
        holiday.date.getDate() === date.getDate() &&
        holiday.date.getMonth() === date.getMonth() &&
        holiday.date.getFullYear() === date.getFullYear()
    );
  }

  getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  toggleDay(day: DayInfo): void {
    if (this.selectionMode === 'comment') {
      this.openCommentDialog(day);
      return;
    }

    if (this.selectionMode === 'single') {
      // Only toggle non-weekend days
      day.isSelected = !day.isSelected;
      this.calculateTotalLeaveDays();
      return;
    }

    if (this.selectionMode === 'range') {
      if (this.rangeStart === null) {
        this.rangeStart = day.date;
        this.tentativeEnd = null;
      } else {
        this.selectRange(this.rangeStart, day.date);
        this.rangeStart = null;
        this.tentativeEnd = null;
      }
    }
  }

  openCommentDialog(day: DayInfo): void {
    const dialogRef = this.dialog.open(CommentDialogComponent, {
      width: '400px',
      data: {
        date: day.date,
        comment: day.comment || '',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result !== undefined) {
        day.comment = result;
        this.calculateTotalLeaveDays();
      }
    });
  }

  selectRange(start: Date, end: Date): void {
    // Ensure start is before end
    if (start > end) {
      [start, end] = [end, start];
    }

    for (const week of this.weeks) {
      for (const day of week.days) {
        if (day.date >= start && day.date <= end) {
          day.isSelected = true;
        }
      }
    }

    this.calculateTotalLeaveDays();
  }

  rangeHover(end: Date) {
    if (this.selectionMode === 'range' && this.rangeStart) {
      this.tentativeEnd = end;
    }
  }

  isInRange(day: Date): boolean {
    if (this.rangeStart === null || this.tentativeEnd === null) {
      return false;
    }
    if (this.tentativeEnd > this.rangeStart) {
      return day >= this.rangeStart && day <= this.tentativeEnd;
    }
    return day >= this.tentativeEnd && day <= this.rangeStart;
  }

  setSelectionMode(mode: 'single' | 'range' | 'comment'): void {
    this.selectionMode = mode;
    this.rangeStart = null;
  }

  applyUKHolidays(): void {
    for (const week of this.weeks) {
      for (const day of week.days) {
        // Find the matching holiday
        const holiday = this.ukBankHolidays.find(
          (h) =>
            h.date.getDate() === day.date.getDate() &&
            h.date.getMonth() === day.date.getMonth() &&
            h.date.getFullYear() === day.date.getFullYear()
        );

        if (holiday) {
          day.isSelected = true; // Mark as selected (annual leave)
          day.isBankHoliday = true; // Mark as a bank holiday
          day.comment = holiday.name; // Add the holiday name as a comment
        }
      }
    }
    this.calculateTotalLeaveDays();
  }

  resetCalendar(): void {
    for (const week of this.weeks) {
      for (const day of week.days) {
        day.isSelected = false;
        day.comment = undefined;
      }
    }
    this.calculateTotalLeaveDays();
  }

  calculateTotalLeaveDays(): void {
    const days = this.weeks.flatMap((week) => week.days);

    this.totalLeaveDays = {
      totalAnnualLeave: days.filter((day) => day.isSelected && !day.isBankHoliday).length,
      totalBankHolidaysTaken: days.filter((day) => day.isSelected && day.isBankHoliday).length,
      total: days.filter((day) => day.isSelected).length,
    }
    this.saveState();
  }

  // Helper for getting the month name from a date
  getMonthName(date: Date): string {
    return date.toLocaleString('default', { month: 'short' });
  }

  // Determine if a date is the 1st day of the month
  isFirstOfMonth(date: Date): boolean {
    return date.getDate() === 1;
  }

  // Get the month class based on month index for alternating backgrounds
  getMonthClass(monthIndex: number): string {
    return monthIndex % 2 === 0 ? 'even-month' : 'odd-month';
  }

  // save component state to local storage
  saveState(): void {
    localStorage.setItem(
      'annual-leave-calculator',
      JSON.stringify({
        weeks: this.weeks,
        leaveForm: this.leaveForm.value,
      })
    );
  }

  // load component state from local storage
  loadState(): {
    weeks: Array<Week & { week: DayInfo & { date: string } }>;
    leaveForm: { startDate: string; endDate: string };
  } | null {
    const state = localStorage.getItem('annual-leave-calculator');

    return state ? JSON.parse(state) : null;
  }
}
