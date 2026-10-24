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

export interface ChatMessageResponse {
  reply: string;
  role: string;
  proposal?: ChatbotActionProposal;
  suggestedChips: string[];
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  proposal?: ChatbotActionProposal;
  suggestedChips?: string[];
  isExecuting?: boolean;
  isConfirmed?: boolean;
  isCancelled?: boolean;
  actionResult?: {
    success: boolean;
    message: string;
  };
}
