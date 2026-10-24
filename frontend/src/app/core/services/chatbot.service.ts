import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  ChatMessage,
  ChatMessageRequest,
  ChatMessageResponse,
  ChatbotActionProposal,
  ConfirmActionRequest,
  ConfirmActionResponse
} from '../models/chatbot.models';

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/chatbot`;

  isOpen = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  messages = signal<ChatMessage[]>([]);
  suggestedChips = signal<string[]>([]);

  constructor() {
    this.initGreeting();
  }

  toggleOpen(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next && this.messages().length === 0) {
      this.initGreeting();
    }
  }

  open(): void {
    this.isOpen.set(true);
    if (this.messages().length === 0) {
      this.initGreeting();
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  initGreeting(): void {
    const user = this.authService.currentUser();
    const role = user?.role || 'User';
    const name = user?.fullName || 'there';

    let greetingText = `Hello **${name}**! I am your **EduAttend AI Assistant**.\n\n`;
    if (role === 'SuperAdmin') {
      greetingText += `I can help you monitor overall platform health, inspect registered colleges, review audit trails, or toggle college statuses.`;
    } else if (role === 'InstituteAdmin') {
      greetingText += `I can help you review today's attendance summary, list defaulters below 75%, or create subjects with instant confirmation cards.`;
    } else if (role === 'Staff') {
      greetingText += `I can help you check your timetable schedule for today, view attendance stats, or check leave requests.`;
    } else if (role === 'Parent') {
      greetingText += `I can help you check your children's real-time attendance or apply for leaves with a single tap.`;
    } else {
      greetingText += `Ask me any question about the platform!`;
    }

    this.messages.set([
      {
        id: 'msg-greeting',
        sender: 'assistant',
        text: greetingText,
        timestamp: new Date()
      }
    ]);

    this.fetchSuggestions();
  }

  fetchSuggestions(): void {
    this.http.get<string[]>(`${this.apiUrl}/suggestions`).subscribe({
      next: (chips) => this.suggestedChips.set(chips),
      error: () => {
        this.suggestedChips.set(['Today Attendance', 'Help', 'Overview']);
      }
    });
  }

  sendMessage(text: string): void {
    const cleanText = text.trim();
    if (!cleanText || this.isLoading()) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: cleanText,
      timestamp: new Date()
    };

    this.messages.update(msgs => [...msgs, userMsg]);
    this.isLoading.set(true);

    const req: ChatMessageRequest = { message: cleanText };

    this.http.post<ChatMessageResponse>(`${this.apiUrl}/message`, req).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const botMsg: ChatMessage = {
          id: 'bot-' + Date.now(),
          sender: 'assistant',
          text: res.reply,
          timestamp: new Date(),
          proposal: res.proposal,
          suggestedChips: res.suggestedChips
        };
        this.messages.update(msgs => [...msgs, botMsg]);
        if (res.suggestedChips && res.suggestedChips.length > 0) {
          this.suggestedChips.set(res.suggestedChips);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorReply = err.error?.message || 'Sorry, I encountered an issue while processing your request. Please try again.';
        const botMsg: ChatMessage = {
          id: 'bot-err-' + Date.now(),
          sender: 'assistant',
          text: `⚠️ **Error**: ${errorReply}`,
          timestamp: new Date()
        };
        this.messages.update(msgs => [...msgs, botMsg]);
      }
    });
  }

  confirmAction(messageId: string, proposal: ChatbotActionProposal): void {
    this.messages.update(msgs =>
      msgs.map(m => m.id === messageId ? { ...m, isExecuting: true } : m)
    );

    const req: ConfirmActionRequest = {
      actionId: proposal.actionId,
      actionType: proposal.actionType,
      payloadJson: proposal.payloadJson
    };

    this.http.post<ConfirmActionResponse>(`${this.apiUrl}/confirm-action`, req).subscribe({
      next: (res) => {
        this.messages.update(msgs =>
          msgs.map(m => m.id === messageId ? {
            ...m,
            isExecuting: false,
            isConfirmed: true,
            actionResult: { success: true, message: res.message }
          } : m)
        );
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Failed to execute the requested action.';
        this.messages.update(msgs =>
          msgs.map(m => m.id === messageId ? {
            ...m,
            isExecuting: false,
            isConfirmed: false,
            actionResult: { success: false, message: errorMsg }
          } : m)
        );
      }
    });
  }

  cancelAction(messageId: string): void {
    this.messages.update(msgs =>
      msgs.map(m => m.id === messageId ? {
        ...m,
        isCancelled: true,
        actionResult: { success: false, message: 'Action cancelled by user.' }
      } : m)
    );
  }

  clearChat(): void {
    this.initGreeting();
  }
}
