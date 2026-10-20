import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClassItem, SubjectItem } from '../models/academic.models';

@Injectable({
  providedIn: 'root'
})
export class AcademicService {
  private http = inject(HttpClient);

  getClasses(): Observable<ClassItem[]> {
    return this.http.get<ClassItem[]>(`${environment.apiUrl}/classes`);
  }

  createClass(name: string, sections = 'A,B'): Observable<ClassItem> {
    return this.http.post<ClassItem>(`${environment.apiUrl}/classes`, { name, sections });
  }

  deleteClass(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/classes/${id}`);
  }

  getSubjects(): Observable<SubjectItem[]> {
    return this.http.get<SubjectItem[]>(`${environment.apiUrl}/subjects`);
  }

  createSubject(name: string, code: string): Observable<SubjectItem> {
    return this.http.post<SubjectItem>(`${environment.apiUrl}/subjects`, { name, code });
  }

  deleteSubject(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/subjects/${id}`);
  }
}
