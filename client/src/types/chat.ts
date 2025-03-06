export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'assistant';
  timestamp: string;
  conversationId?: string;
  structuredData?: {
    summary: string;
    key_insights: string[];
    data: Record<string, any>;
    tables?: any[][];
  };
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
