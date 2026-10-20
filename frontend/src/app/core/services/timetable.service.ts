import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Period, TimetableEntry, CreateTimetableEntryRequest } from '../models/timetable.models';

@Injectable({
  providedIn: 'root'
})
export class TimetableService {
  private http = inject(HttpClient);

  getPeriods(): Observable<Period[]> {
    return this.http.get<Period[]>(`${environment.apiUrl}/periods`);
  }

  createPeriod(period: { periodNumber: number; name: string; startTime: string; endTime: string }): Observable<Period> {
    return this.http.post<Period>(`${environment.apiUrl}/periods`, period);
  }

  deletePeriod(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/periods/${id}`);
  }

  getClassTimetable(classId: number, section: string): Observable<TimetableEntry[]> {
    return this.http.get<TimetableEntry[]>(`${environment.apiUrl}/timetable/class?classId=${classId}&section=${section}`);
  }

  getStaffTimetable(staffId: number): Observable<TimetableEntry[]> {
    return this.http.get<TimetableEntry[]>(`${environment.apiUrl}/timetable/staff/${staffId}`);
  }

  createEntry(entry: CreateTimetableEntryRequest): Observable<TimetableEntry> {
    return this.http.post<TimetableEntry>(`${environment.apiUrl}/timetable`, entry);
  }

  deleteEntry(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/timetable/${id}`);
  }
}
