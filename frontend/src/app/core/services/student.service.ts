import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Student, ExcelImportPreviewResult } from '../models/academic.models';

export interface StudentListResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: Student[];
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/students`;

  getAll(filter: { classId?: number; section?: string; search?: string; page?: number; pageSize?: number }): Observable<StudentListResponse> {
    let params = new HttpParams();
    if (filter.classId) params = params.set('classId', filter.classId.toString());
    if (filter.section) params = params.set('section', filter.section);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.page) params = params.set('page', filter.page.toString());
    if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());

    return this.http.get<StudentListResponse>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/${id}`);
  }

  create(student: Partial<Student>): Observable<Student> {
    return this.http.post<Student>(this.apiUrl, student);
  }

  update(id: number, student: Partial<Student>): Observable<Student> {
    return this.http.put<Student>(`${this.apiUrl}/${id}`, student);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/import-template`, { responseType: 'blob' });
  }

  previewImport(file: File): Observable<ExcelImportPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ExcelImportPreviewResult>(`${this.apiUrl}/import-preview`, formData);
  }

  confirmImport(students: Partial<Student>[]): Observable<{ message: string; importedCount: number; skippedCount: number }> {
    return this.http.post<{ message: string; importedCount: number; skippedCount: number }>(
      `${this.apiUrl}/import-confirm`,
      { students }
    );
  }
}
