import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SubjectItem, ClassSubjectDto } from '../models/academic.models';

export interface CreateSubjectRequest {
  name: string;
  code: string;
  classAssignments?: { classId: number; defaultStaffId?: number }[];
}

export interface UpdateSubjectRequest {
  name: string;
  code: string;
}

export interface AssignSubjectClassesRequest {
  assignments: { classId: number; defaultStaffId?: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class SubjectService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/subjects`;

  getAll(): Observable<SubjectItem[]> {
    return this.http.get<SubjectItem[]>(this.apiUrl);
  }

  getById(id: number): Observable<SubjectItem> {
    return this.http.get<SubjectItem>(`${this.apiUrl}/${id}`);
  }

  getByClass(classId: number): Observable<ClassSubjectDto[]> {
    return this.http.get<ClassSubjectDto[]>(`${this.apiUrl}/by-class/${classId}`);
  }

  create(subject: CreateSubjectRequest): Observable<SubjectItem> {
    return this.http.post<SubjectItem>(this.apiUrl, subject);
  }

  update(id: number, subject: UpdateSubjectRequest): Observable<SubjectItem> {
    return this.http.put<SubjectItem>(`${this.apiUrl}/${id}`, subject);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  assignClasses(subjectId: number, assignments: { classId: number; defaultStaffId?: number }[]): Observable<SubjectItem> {
    return this.http.post<SubjectItem>(`${this.apiUrl}/${subjectId}/assign-classes`, { assignments });
  }

  assignClassSubjects(classId: number, assignments: { subjectId: number; defaultStaffId?: number }[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/assign-class-subjects`, { classId, assignments });
  }
}
