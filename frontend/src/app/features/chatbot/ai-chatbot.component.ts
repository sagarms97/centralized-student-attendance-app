import { Component, inject, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ChatbotService } from '../../core/services/chatbot.service';
import { AuthService } from '../../core/services/auth.service';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import { ChatbotActionProposal, ChatSuggestionOption } from '../../core/models/chatbot.models';

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
    MatTooltipModule,
    MatMenuModule
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
        <div class="chat-messages" #scrollContainer (click)="onChatContentClick($event)">
          @for (m of chatbotService.messages(); track m.id) {
            <div class="message-row" [class.user-row]="m.sender === 'user'" [class.bot-row]="m.sender === 'assistant'">
              @if (m.sender === 'assistant') {
                <div class="avatar-small">
                  <mat-icon>smart_toy</mat-icon>
                </div>
              }

              <div class="message-bubble" [class.user-bubble]="m.sender === 'user'" [class.bot-bubble]="m.sender === 'assistant'">
                <!-- Formatted Message Text -->
                <div class="message-text" [innerHTML]="formatMessage(m.text)" (click)="onLinkClick($event)"></div>

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
                            <ng-container>
                              <mat-icon>check_circle</mat-icon>
                              <span>Confirm & Execute</span>
                            </ng-container>
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

                <!-- Navigation Action Card -->
                @if (m.actionData && m.actionData.type === 'navigate') {
                  <div class="nav-action-card">
                    <button type="button" class="nav-direct-btn" (click)="navigateToRoute(m.actionData.route)">
                      <mat-icon>open_in_new</mat-icon>
                      <span>Open {{ m.actionData.label }}</span>
                    </button>
                  </div>
                }

                <!-- Related Suggestions / Fallback Options -->
                @if (m.suggestions && m.suggestions.length > 0) {
                  <div class="message-suggestions">
                    @for (s of m.suggestions; track s.label) {
                      <button
                        type="button"
                        class="suggestion-btn"
                        [class.nav-btn]="s.action === 'navigate'"
                        (click)="onSuggestionClick(s)">
                        <mat-icon class="btn-icon">{{ s.action === 'navigate' ? 'open_in_new' : 'chat_bubble_outline' }}</mat-icon>
                        <span>{{ s.label }}</span>
                      </button>
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

        <!-- Voice Error Notification Banner -->
        @if (speechService.errorMessage()) {
          <div class="voice-error-banner">
            <mat-icon class="banner-icon">error_outline</mat-icon>
            <span class="banner-text">{{ speechService.errorMessage() }}</span>
            <button mat-icon-button (click)="speechService.clearError()" class="banner-close" aria-label="Close error">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        <!-- Voice Live Listening Indicator -->
        @if (speechService.isListening()) {
          <div class="voice-listening-indicator">
            <span class="pulse-dot"></span>
            <span class="listening-text">Listening ({{ getSelectedLanguageLabel() }})... Speak now</span>
            <button mat-button class="stop-listening-btn" (click)="speechService.stopListening()">Done</button>
          </div>
        }

        <!-- Chat Input Bar -->
        <div class="chat-input-bar">
          <!-- Language Selector Pill -->
          <button
            mat-button
            [matMenuTriggerFor]="langMenu"
            class="lang-select-btn"
            matTooltip="Speech language (English, Hindi, Kannada)"
            type="button">
            <span class="lang-flag">{{ getSelectedLanguageShort() }}</span>
            <mat-icon class="lang-arrow">arrow_drop_down</mat-icon>
          </button>

          <mat-menu #langMenu="matMenu" class="voice-lang-menu">
            @for (lang of speechService.supportedLanguages; track lang.code) {
              <button mat-menu-item (click)="speechService.setLanguage(lang.code)">
                <span [class.active-lang]="speechService.selectedLanguage() === lang.code">{{ lang.label }}</span>
                @if (speechService.selectedLanguage() === lang.code) {
                  <mat-icon color="primary" class="check-icon">check</mat-icon>
                }
              </button>
            }
          </mat-menu>

          <input
            #messageInput
            type="text"
            [(ngModel)]="userInput"
            (keydown.enter)="onSend()"
            placeholder="Ask AI or speak in EN/HI/KN..."
            [disabled]="chatbotService.isLoading()"
            class="chat-input" />

          <!-- Mic Button -->
          <button
            mat-icon-button
            type="button"
            class="mic-btn"
            [class.listening]="speechService.isListening()"
            (click)="onToggleVoice()"
            [disabled]="chatbotService.isLoading()"
            [matTooltip]="speechService.isListening() ? 'Stop listening' : 'Voice input (Mic)'"
            aria-label="Voice input">
            <mat-icon>{{ speechService.isListening() ? 'mic' : 'mic_none' }}</mat-icon>
          </button>

          <!-- Send Button -->
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
      gap: 4px;
    }
    .header-btn {
      color: #ffffff !important;
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: visible !important;
      box-sizing: border-box !important;

      ::ng-deep .mat-mdc-button-touch-target {
        display: none !important;
      }
      mat-icon {
        font-size: 20px !important;
        width: 20px !important;
        height: 20px !important;
        line-height: 20px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        overflow: visible !important;
      }
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
      line-height: 1.5;
      word-break: break-word;
      overflow-wrap: break-word;
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
      white-space: normal;
      word-break: break-word;
      overflow-wrap: break-word;
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

    /* Direct Navigation Action Card */
    .nav-action-card {
      margin-top: 10px;
      margin-bottom: 6px;
    }
    .nav-direct-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1a237e;
      color: #ffffff;
      border: none;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(26, 35, 126, 0.2);
      transition: all 0.2s;
      &:hover {
        background: #283593;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(26, 35, 126, 0.3);
      }
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    /* Message Suggestions / Fallback Buttons */
    .message-suggestions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 10px;
      margin-bottom: 6px;
    }
    .suggestion-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease-in-out;
      width: 100%;
      &:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
        color: #0f172a;
      }
      &.nav-btn {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
        font-weight: 600;
        &:hover {
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1e40af;
        }
      }
      .btn-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        flex-shrink: 0;
      }
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
      scrollbar-width: thin;
      &::-webkit-scrollbar { height: 4px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    }
    .suggestion-chip {
      flex-shrink: 0;
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

    /* Voice & Language Bar Styles */
    .voice-error-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #fef2f2;
      border-top: 1px solid #fecaca;
      color: #991b1b;
      font-size: 11.5px;
      .banner-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .banner-text {
        flex: 1;
      }
      .banner-close {
        width: 20px;
        height: 20px;
        line-height: 20px;
        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }

    .voice-listening-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: linear-gradient(90deg, #e0e7ff 0%, #ede9fe 100%);
      border-top: 1px solid #c7d2fe;
      color: #3730a3;
      font-size: 11.5px;
      font-weight: 500;
      .listening-text {
        flex: 1;
      }
      .pulse-dot {
        width: 8px;
        height: 8px;
        background-color: #ef4444;
        border-radius: 50%;
        animation: voice-blink 1s infinite alternate;
      }
      .stop-listening-btn {
        height: 22px;
        line-height: 22px;
        font-size: 11px;
        padding: 0 8px;
        min-width: unset;
        background: #4f46e5;
        color: #fff;
        border-radius: 10px;
      }
    }
    @keyframes voice-blink {
      0% { opacity: 0.3; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1.2); }
    }

    .lang-select-btn {
      min-width: unset;
      padding: 0 6px;
      height: 32px;
      line-height: 32px;
      border-radius: 16px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 11.5px;
      font-weight: 600;
      color: #334155;
      &:hover {
        background: #e2e8f0;
      }
    }
    .lang-arrow {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .active-lang {
      font-weight: 700;
      color: #1a237e;
    }
    .check-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-left: auto;
    }

    /* Markdown Navigation Links */
    .chat-nav-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #3730a3 !important;
      font-weight: 600;
      font-size: 12.5px;
      padding: 4px 10px;
      margin: 4px 2px;
      border-radius: 12px;
      text-decoration: none !important;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.1);
      transition: all 0.15s ease-in-out;
      &:hover {
        background: #4f46e5;
        border-color: #4338ca;
        color: #ffffff !important;
        transform: translateY(-1px);
        box-shadow: 0 3px 6px rgba(79, 70, 229, 0.25);
      }
      .link-arrow {
        font-size: 14px;
        font-weight: bold;
      }
    }

    .mic-btn,
    .send-btn {
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: visible !important;
      box-sizing: border-box !important;

      ::ng-deep .mat-mdc-button-touch-target {
        display: none !important;
      }

      mat-icon {
        font-size: 20px !important;
        width: 20px !important;
        height: 20px !important;
        line-height: 20px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        overflow: visible !important;
      }
    }

    .mic-btn {
      color: #475569;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      &:hover {
        background: #f1f5f9;
        color: #1a237e;
      }
      &.listening {
        background: #ef4444 !important;
        color: #ffffff !important;
        animation: mic-glow 1.5s infinite;
      }
    }
    @keyframes mic-glow {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
      70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
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
      color: #1a237e !important;
    }
  `]
})
export class AiChatbotComponent implements AfterViewChecked, OnDestroy {
  chatbotService = inject(ChatbotService);
  authService = inject(AuthService);
  speechService = inject(SpeechRecognitionService);
  router = inject(Router);
  sanitizer = inject(DomSanitizer);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef;
  @ViewChild('messageInput') private messageInput?: ElementRef;

  userInput: string = '';

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.speechService.stopListening();
  }

  onToggleVoice(): void {
    this.speechService.toggleListening((transcript, isFinal) => {
      this.userInput = transcript;
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    });
  }

  getSelectedLanguageShort(): string {
    const cur = this.speechService.selectedLanguage();
    const found = this.speechService.supportedLanguages.find(l => l.code === cur);
    return found ? found.short : 'EN';
  }

  getSelectedLanguageLabel(): string {
    const cur = this.speechService.selectedLanguage();
    const found = this.speechService.supportedLanguages.find(l => l.code === cur);
    return found ? found.label : 'English';
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

  onSuggestionClick(s: ChatSuggestionOption): void {
    if (s.action === 'navigate' && s.route) {
      this.navigateToRoute(s.route);
    } else {
      const text = s.query || s.label;
      this.chatbotService.sendMessage(text);
    }
  }

  navigateToRoute(route: string): void {
    if (!route) return;
    this.router.navigateByUrl(route).then(() => {
      this.chatbotService.close();
    });
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

  onLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const link = (target.tagName === 'A' ? target : target.closest('a')) as HTMLAnchorElement | null;
    if (!link) return;

    const url = link.getAttribute('data-url') || link.getAttribute('href');
    if (url && (url.startsWith('/') || url.startsWith('#'))) {
      event.preventDefault();
      event.stopPropagation();
      const cleanUrl = url.replace(/^#/, '');
      this.router.navigateByUrl(cleanUrl).then(() => {
        // Automatically minimize/close chatbot window so the user sees and interacts with the page
        this.chatbotService.close();
      });
    }
  }

  onChatContentClick(event: MouseEvent): void {
    this.onLinkClick(event);
  }

  formatMessage(text: string): SafeHtml {
    if (!text) return '';
    // Format bold: **text** -> <strong>text</strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format code: `text` -> <code>text</code>
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:12px;">$1</code>');
    // Format markdown links: [Title](url) -> <a class="chat-nav-link" href="$2" data-url="$2"><span>$1</span><span class="link-arrow">↗</span></a>
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="chat-nav-link" href="$2" data-url="$2"><span>$1</span><span class="link-arrow">↗</span></a>');
    // Replace newlines with <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }
}
