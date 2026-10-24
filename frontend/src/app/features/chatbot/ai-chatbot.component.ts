import { Component, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatbotService } from '../../core/services/chatbot.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatbotActionProposal } from '../../core/models/chatbot.models';

@Component({
  selector: 'app-ai-chatbot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <!-- Floating Action Button (FAB) -->
    <div class="chatbot-fab-wrapper" [class.hidden]="chatbotService.isOpen()">
      <button
        mat-fab
        color="primary"
        class="chatbot-fab"
        (click)="chatbotService.toggleOpen()"
        matTooltip="Chat with EduAttend AI"
        aria-label="Open AI Assistant">
        <mat-icon class="fab-icon">smart_toy</mat-icon>
      </button>
      <span class="fab-pulse"></span>
    </div>

    <!-- Chatbot Window Drawer -->
    @if (chatbotService.isOpen()) {
      <div class="chatbot-window">
        <!-- Header -->
        <div class="chat-header">
          <div class="header-info">
            <div class="bot-avatar">
              <mat-icon>smart_toy</mat-icon>
            </div>
            <div class="title-meta">
              <h3>EduAttend AI</h3>
              <div class="role-pill">
                <span class="online-dot"></span>
                <span>{{ authService.currentUser()?.role || 'Assistant' }}</span>
              </div>
            </div>
          </div>

          <div class="header-actions">
            <button mat-icon-button (click)="chatbotService.clearChat()" matTooltip="Clear conversation" class="header-btn">
              <mat-icon>delete_sweep</mat-icon>
            </button>
            <button mat-icon-button (click)="chatbotService.close()" matTooltip="Minimize" class="header-btn">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Chat Messages Container -->
        <div class="chat-messages" #scrollContainer>
          @for (m of chatbotService.messages(); track m.id) {
            <div class="message-row" [class.user-row]="m.sender === 'user'" [class.bot-row]="m.sender === 'assistant'">
              @if (m.sender === 'assistant') {
                <div class="avatar-small">
                  <mat-icon>smart_toy</mat-icon>
                </div>
              }

              <div class="message-bubble" [class.user-bubble]="m.sender === 'user'" [class.bot-bubble]="m.sender === 'assistant'">
                <!-- Formatted Message Text -->
                <div class="message-text" [innerHTML]="formatMessage(m.text)"></div>

                <!-- Action Proposal Card (Human-in-the-Loop Confirmation) -->
                @if (m.proposal) {
                  <div class="proposal-card">
                    <div class="proposal-header">
                      <mat-icon class="action-icon">bolt</mat-icon>
                      <span class="action-title">{{ m.proposal.title }}</span>
                    </div>

                    <p class="proposal-summary">{{ m.proposal.summary }}</p>

                    <!-- Parameters Table -->
                    <div class="params-table">
                      @for (p of getParamEntries(m.proposal.parameters); track p.key) {
                        <div class="param-row">
                          <span class="param-key">{{ p.key }}:</span>
                          <span class="param-val">{{ p.value }}</span>
                        </div>
                      }
                    </div>

                    <!-- Action State Buttons -->
                    @if (!m.isConfirmed && !m.isCancelled) {
                      <div class="proposal-actions">
                        <button
                          mat-flat-button
                          color="primary"
                          class="confirm-btn"
                          [disabled]="m.isExecuting"
                          (click)="onConfirm(m.id, m.proposal)">
                          @if (m.isExecuting) {
                            <mat-spinner diameter="16" class="spinner-inline"></mat-spinner>
                            <span>Executing...</span>
                          } @else {
                            <mat-icon>check_circle</mat-icon>
                            <span>Confirm & Execute</span>
                          }
                        </button>

                        <button
                          mat-stroked-button
                          class="cancel-btn"
                          [disabled]="m.isExecuting"
                          (click)="onCancel(m.id)">
                          <span>Cancel</span>
                        </button>
                      </div>
                    } @else if (m.isConfirmed) {
                      <div class="status-result success">
                        <mat-icon>task_alt</mat-icon>
                        <span>{{ m.actionResult?.message || 'Action successfully executed!' }}</span>
                      </div>
                    } @else if (m.isCancelled) {
                      <div class="status-result cancelled">
                        <mat-icon>cancel</mat-icon>
                        <span>Action was cancelled.</span>
                      </div>
                    }
                  </div>
                }

                <span class="message-time">{{ m.timestamp | date:'shortTime' }}</span>
              </div>
            </div>
          }

          <!-- Typing Indicator -->
          @if (chatbotService.isLoading()) {
            <div class="message-row bot-row">
              <div class="avatar-small">
                <mat-icon>smart_toy</mat-icon>
              </div>
              <div class="typing-bubble">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          }
        </div>

        <!-- Suggestion Chips Row -->
        @if (chatbotService.suggestedChips().length > 0) {
          <div class="chips-container">
            @for (chip of chatbotService.suggestedChips(); track chip) {
              <button type="button" class="suggestion-chip" (click)="onChipClick(chip)">
                {{ chip }}
              </button>
            }
          </div>
        }

        <!-- Chat Input Bar -->
        <div class="chat-input-bar">
          <input
            #messageInput
            type="text"
            [(ngModel)]="userInput"
            (keydown.enter)="onSend()"
            placeholder="Ask AI or type an action..."
            [disabled]="chatbotService.isLoading()"
            class="chat-input" />

          <button
            mat-icon-button
            color="primary"
            (click)="onSend()"
            [disabled]="!userInput.trim() || chatbotService.isLoading()"
            class="send-btn"
            aria-label="Send message">
            <mat-icon>send</mat-icon>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    /* FAB Launcher */
    .chatbot-fab-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      &.hidden { display: none; }
    }
    .chatbot-fab {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #1a237e 0%, #3f51b5 100%) !important;
      color: #fff !important;
      box-shadow: 0 4px 16px rgba(26, 35, 126, 0.4) !important;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      &:hover {
        transform: scale(1.08);
      }
    }
    .fab-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .fab-pulse {
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid #3f51b5;
      animation: pulse 2.5s infinite;
      pointer-events: none;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    /* Window Drawer */
    .chatbot-window {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 580px;
      max-height: calc(100vh - 48px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 1001;
      border: 1px solid #e0e7ff;
      animation: slideUp 0.25s cubic-bezier(0, 0, 0.2, 1);
    }
    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Header */
    .chat-header {
      background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
      color: #ffffff;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bot-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .title-meta h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .role-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      margin-top: 2px;
    }
    .online-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4caf50;
    }
    .header-actions {
      display: flex;
      gap: 2px;
    }
    .header-btn {
      color: #ffffff !important;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Message Thread */
    .chat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: #f8fafc;
    }
    .message-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      &.user-row { justify-content: flex-end; }
      &.bot-row { justify-content: flex-start; }
    }
    .avatar-small {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #3f51b5;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .message-bubble {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      position: relative;
      font-size: 13.5px;
      line-height: 1.45;
      word-wrap: break-word;
    }
    .user-bubble {
      background: #1a237e;
      color: #ffffff;
      border-bottom-right-radius: 4px;
      .message-time { color: rgba(255, 255, 255, 0.7); text-align: right; }
    }
    .bot-bubble {
      background: #ffffff;
      color: #1e293b;
      border-bottom-left-radius: 4px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      .message-time { color: #94a3b8; text-align: left; }
    }
    .message-text {
      white-space: pre-wrap;
      p { margin: 0 0 6px 0; }
      strong { font-weight: 600; }
    }
    .message-time {
      display: block;
      font-size: 10px;
      margin-top: 4px;
    }

    /* Action Proposal Card */
    .proposal-card {
      margin-top: 10px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
    }
    .proposal-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 13px;
      color: #1a237e;
      margin-bottom: 6px;
    }
    .action-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #f59e0b;
    }
    .proposal-summary {
      font-size: 12px;
      color: #475569;
      margin: 0 0 8px 0;
    }
    .params-table {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 10px;
    }
    .param-row {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      padding: 3px 0;
      border-bottom: 1px dashed #f1f5f9;
      &:last-child { border-bottom: none; }
    }
    .param-key { color: #64748b; font-weight: 500; }
    .param-val { color: #0f172a; font-weight: 600; text-align: right; }
    .proposal-actions {
      display: flex;
      gap: 8px;
    }
    .confirm-btn {
      flex: 1;
      font-size: 12px !important;
      height: 32px !important;
      line-height: 32px !important;
      background-color: #1a237e !important;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }
    .cancel-btn {
      font-size: 12px !important;
      height: 32px !important;
      line-height: 32px !important;
      color: #64748b !important;
    }
    .status-result {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.success {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      &.cancelled {
        background: #f8fafc;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }
    }
    .spinner-inline {
      display: inline-block;
      margin-right: 6px;
    }

    /* Typing Dots */
    .typing-bubble {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .dot {
      width: 7px;
      height: 7px;
      background: #94a3b8;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
      &:nth-child(1) { animation-delay: -0.32s; }
      &:nth-child(2) { animation-delay: -0.16s; }
    }
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Suggestions Row */
    .chips-container {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      white-space: nowrap;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }
    .suggestion-chip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 11.5px;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 14px;
      cursor: pointer;
      transition: background 0.15s;
      &:hover {
        background: #dbeafe;
      }
    }

    /* Input Bar */
    .chat-input-bar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      gap: 6px;
    }
    .chat-input {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
      &:focus {
        border-color: #1a237e;
      }
    }
    .send-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1a237e !important;
    }
  `]
})
export class AiChatbotComponent implements AfterViewChecked {
  chatbotService = inject(ChatbotService);
  authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef;
  @ViewChild('messageInput') private messageInput?: ElementRef;

  userInput: string = '';

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      try {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      } catch {}
    }
  }

  onSend(): void {
    if (!this.userInput.trim()) return;
    const text = this.userInput;
    this.userInput = '';
    this.chatbotService.sendMessage(text);
  }

  onChipClick(chipText: string): void {
    this.chatbotService.sendMessage(chipText);
  }

  onConfirm(messageId: string, proposal: ChatbotActionProposal): void {
    this.chatbotService.confirmAction(messageId, proposal);
  }

  onCancel(messageId: string): void {
    this.chatbotService.cancelAction(messageId);
  }

  getParamEntries(params: { [key: string]: string }): { key: string; value: string }[] {
    if (!params) return [];
    return Object.keys(params).map(k => ({ key: k, value: params[k] }));
  }

  formatMessage(text: string): string {
    if (!text) return '';
    // Format bold: **text** -> <strong>text</strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format code: `text` -> <code>text</code>
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:12px;">$1</code>');
    return formatted;
  }
}
