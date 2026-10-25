export interface ChatbotActionProposal {
  actionId: string;
  actionType: string;
  title: string;
  summary: string;
  parameters: { [key: string]: string };
  payloadJson: string;
  expiresAt: string;
}

export interface ChatMessageRequest {
  message: string;
}

export interface ChatSuggestionOption {
  label: string;
  action: 'navigate' | 'send_message';
  route?: string;
  query?: string;
  routeKey?: string;
}

export interface ChatMessageResponse {
  reply: string;
  role: string;
  proposal?: ChatbotActionProposal;
  suggestedChips: string[];
  actionData?: any;
  suggestions?: ChatSuggestionOption[];
}

export interface ConfirmActionRequest {
  actionId: string;
  actionType: string;
  payloadJson: string;
}

export interface ConfirmActionResponse {
  success: boolean;
  message: string;
  resultData?: any;
}

export interface TranscribeResponse {
  success: boolean;
  transcript: string;
  language: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  proposal?: ChatbotActionProposal;
  suggestedChips?: string[];
  actionData?: any;
  suggestions?: ChatSuggestionOption[];
  isExecuting?: boolean;
  isConfirmed?: boolean;
  isCancelled?: boolean;
  actionResult?: {
    success: boolean;
    message: string;
  };
}
