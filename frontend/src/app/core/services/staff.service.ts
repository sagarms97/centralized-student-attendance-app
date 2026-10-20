import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Staff } from '../models/academic.models';

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/staff`;

  getAll(includeInactive = false): Observable<Staff[]> {
    return this.http.get<Staff[]>(`${this.apiUrl}?includeInactive=${includeInactive}`);
  }

  getById(id: number): Observable<Staff> {
    return this.http.get<Staff>(`${this.apiUrl}/${id}`);
  }

  create(staff: Partial<Staff> & { initialPassword?: string }): Observable<Staff> {
    return this.http.post<Staff>(this.apiUrl, staff);
  }

  update(id: number, staff: Partial<Staff>): Observable<Staff> {
    return this.http.put<Staff>(`${this.apiUrl}/${id}`, staff);
  }

  uploadPhoto(id: number, file: File): Observable<{ photoPath: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoPath: string; message: string }>(`${this.apiUrl}/${id}/photo`, formData);
  }

  getPhotoUrl(id: number): string {
    return `${this.apiUrl}/${id}/photo`;
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
