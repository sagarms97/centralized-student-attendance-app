import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DailyAttendanceReportItem, StudentAttendanceSummary, ClassSummary } from '../models/report.models';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/reports`;

  getDailyReport(filter: { startDate?: string; endDate?: string; classId?: number; subjectId?: number }): Observable<DailyAttendanceReportItem[]> {
    let params = new HttpParams();
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.classId) params = params.set('classId', filter.classId.toString());
    if (filter.subjectId) params = params.set('subjectId', filter.subjectId.toString());

    return this.http.get<DailyAttendanceReportItem[]>(`${this.apiUrl}/daily`, { params });
  }

  getStudentReport(filter: { classId?: number; section?: string; subjectId?: number; startDate?: string; endDate?: string; defaulterThreshold?: number }): Observable<StudentAttendanceSummary[]> {
    let params = new HttpParams();
    if (filter.classId) params = params.set('classId', filter.classId.toString());
    if (filter.section) params = params.set('section', filter.section);
    if (filter.subjectId) params = params.set('subjectId', filter.subjectId.toString());
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.defaulterThreshold !== undefined) params = params.set('defaulterThreshold', filter.defaulterThreshold.toString());

    return this.http.get<StudentAttendanceSummary[]>(`${this.apiUrl}/students`, { params });
  }

  getClassSummary(startDate?: string, endDate?: string): Observable<ClassSummary[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get<ClassSummary[]>(`${this.apiUrl}/class-summary`, { params });
  }

  exportExcel(classId?: number, section?: string, defaulterThreshold = 75): Observable<Blob> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId.toString());
    if (section) params = params.set('section', section);
    params = params.set('defaulterThreshold', defaulterThreshold.toString());

    return this.http.get(`${this.apiUrl}/export-excel`, { params, responseType: 'blob' });
  }

  exportPdf(classId?: number, section?: string, defaulterThreshold = 75): Observable<Blob> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId.toString());
    if (section) params = params.set('section', section);
    params = params.set('defaulterThreshold', defaulterThreshold.toString());

    return this.http.get(`${this.apiUrl}/export-pdf`, { params, responseType: 'blob' });
  }
}
