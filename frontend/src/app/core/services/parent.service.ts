import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ParentItem, CreateParentRequest, UpdateParentRequest } from '../models/parent.models';

@Injectable({
  providedIn: 'root'
})
export class ParentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/parents`;

  getAll(search?: string): Observable<ParentItem[]> {
    const url = search ? `${this.apiUrl}?search=${encodeURIComponent(search)}` : this.apiUrl;
    return this.http.get<ParentItem[]>(url);
  }

  getById(id: number): Observable<ParentItem> {
    return this.http.get<ParentItem>(`${this.apiUrl}/${id}`);
  }

  create(parent: CreateParentRequest): Observable<ParentItem> {
    return this.http.post<ParentItem>(this.apiUrl, parent);
  }

  update(id: number, parent: UpdateParentRequest): Observable<ParentItem> {
    return this.http.put<ParentItem>(`${this.apiUrl}/${id}`, parent);
  }

  linkStudent(parentId: number, studentId: number, relationship = 'Parent'): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${parentId}/link-student`, { studentId, relationship });
  }

  unlinkStudent(parentId: number, studentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${parentId}/unlink-student/${studentId}`);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
