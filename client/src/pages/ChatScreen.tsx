import React, { useState, useEffect, useCallback } from 'react';

import { v4 as uuidv4 } from 'uuid';
import ChatHeader from '../components/chat/ChatHeader';
import ChatContainer from '../components/chat/ChatContainer';
import ChatInput from '../components/chat/ChatInput';
import ConversationList from '../components/chat/ConversationList';
import { chatApi } from '../api/chatApi';
import { User } from 'lucide-react';

interface StructuredData {
  summary: string;
  key_insights: string[];
  data: Record<string, any>;
}

interface Message {
  id: string;
  content: string;
  sender: 'ai' | 'user';
  structuredData?: StructuredData;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

const ChatScreen: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Load conversations from localStorage or initialize with default
  useEffect(() => {
    const savedConversations = localStorage.getItem('conversations');
    const savedActiveId = localStorage.getItem('activeConversationId');
    
    if (savedConversations) {
      let parsedConversations = JSON.parse(savedConversations);
      
      // Ensure all conversations have valid dates
      parsedConversations = parsedConversations.map((conv: Conversation) => ({
        ...conv,
        date: conv.date || new Date().toISOString()
      }));

      // Sort conversations by date (newest first)
      parsedConversations.sort((a: Conversation, b: Conversation) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setConversations(parsedConversations);
      
      if (savedActiveId && parsedConversations.find((c: Conversation) => c.id === savedActiveId)) {
        setActiveConversationId(savedActiveId);
      } else if (parsedConversations.length > 0) {
        setActiveConversationId(parsedConversations[0].id);
      }
    } else {
      // Initialize with a default conversation if none exists
      const defaultConversation: Conversation = {
        id: uuidv4(),
        title: 'New Chat',
        date: new Date().toISOString(),
        messages: []
      };
      setConversations([defaultConversation]);
      setActiveConversationId(defaultConversation.id);
    }
  }, []);

  // Save conversations and active ID to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      // Ensure all conversations have proper dates before saving
      const conversationsWithDates = conversations.map(conv => ({
        ...conv,
        date: conv.date || new Date().toISOString()
      }));

      localStorage.setItem('conversations', JSON.stringify(conversationsWithDates));
      if (activeConversationId) {
        localStorage.setItem('activeConversationId', activeConversationId);
      }
    }
  }, [conversations, activeConversationId]);

  const activeConversation = conversations.find(conv => conv.id === activeConversationId);
  
  const handleExportChat = useCallback(async () => {
    if (!activeConversation) return;

    try {
      const tables: any[] = [];
      
      // Extract tables from structured data
      activeConversation.messages.forEach(message => {
        if (message.sender === 'ai' && message.structuredData?.data) {
          const data = message.structuredData.data;
          if (Array.isArray(data)) {
            tables.push(data);
          } else if (typeof data === 'object') {
            Object.values(data).forEach(value => {
              if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                tables.push(value);
              }
            });
          }
        }
      });

      if (tables.length > 0) {
        // Dynamically import xlsx
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        
        tables.forEach((table, index) => {
          const ws = XLSX.utils.json_to_sheet(table);
          XLSX.utils.book_append_sheet(wb, ws, `Table ${index + 1}`);
        });
        
        XLSX.writeFile(wb, `${activeConversation.title}.xlsx`);
      } else {
        // Fallback to text export
        const content = activeConversation.messages
          .map(m => `${m.sender}: ${m.content}`)
          .join('\n\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeConversation.title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting chat:', error);
      alert('Failed to export chat. Please try again.');
    }
  }, [activeConversation]);

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim()) return;
    
    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      content,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    // Update conversation with user message
    setConversations(prevConversations => 
      prevConversations.map(conv => 
        conv.id === activeConversationId 
          ? { 
              ...conv, 
              messages: [...conv.messages, userMessage],
              // Update title if this is the first message
              title: conv.messages.length === 0 ? content.slice(0, 30) + (content.length > 30 ? '...' : '') : conv.title
            } 
          : conv
      )
    );
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await chatApi.sendMessage(content);
      
      // Handle error response
      if (response?.error) {
        const errorMessage: Message = {
          id: uuidv4(),
          content: response.error,
          sender: 'ai'
        };
        setConversations(prevConversations => 
          prevConversations.map(conv => 
            conv.id === activeConversationId 
              ? { ...conv, messages: [...conv.messages, errorMessage] } 
              : conv
          )
        );
        return;
      }

      // Process the response data
      const processData = (data: any) => {
        if (!data) return {};
        if (typeof data !== 'object') return { value: data };
        
        return Object.fromEntries(
          Object.entries(data).map(([key, value]) => {
            if (Array.isArray(value)) {
              // Convert array of strings to array of objects
              const processedArray = value.map(item => {
                if (typeof item === 'string') {
                  // If it's a single word/name, convert to object
                  return { name: item };
                } else if (typeof item === 'object' && item !== null) {
                  // If it's an object, ensure all values are properly formatted
                  return Object.fromEntries(
                    Object.entries(item).map(([k, v]) => [
                      k,
                      typeof v === 'object' ? JSON.stringify(v) : v
                    ])
                  );
                }
                return item;
              });
              return [key, processedArray];
            }
            return [key, value];
          })
        );
      };

      // Create AI response message
      const aiMessage: Message = {
        id: uuidv4(),
        content: response.data?.summary || "I'm sorry, I couldn't process that request.",
        sender: 'ai',
        structuredData: {
          summary: response.data?.summary || '',
          key_insights: response.data?.key_insights || [],
          data: processData(response.data?.data)
        }
      };
      
      // Update conversation with AI response
      setConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === activeConversationId 
            ? { ...conv, messages: [...conv.messages, aiMessage] } 
            : conv
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: uuidv4(),
        content: "Sorry, I couldn't process your request. The API might be unavailable or there was a network issue.",
        sender: 'ai'
      };
      
      setConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === activeConversationId 
            ? { ...conv, messages: [...conv.messages, errorMessage] } 
            : conv
        )
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteConversation = (conversationId: string) => {
    // Don't delete if it's the only conversation
    if (conversations.length === 1) {
      return;
    }

    // Remove the conversation
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
    setConversations(updatedConversations);

    // Update localStorage
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));

    // If we're deleting the active conversation, switch to another one
    if (conversationId === activeConversationId) {
      const newActiveId = updatedConversations[0]?.id;
      setActiveConversationId(newActiveId);
      localStorage.setItem('activeConversationId', newActiveId);
    }
  };

  const handleNewConversation = () => {
    const newConversationId = uuidv4();
    const newConversation: Conversation = {
      id: newConversationId,
      title: 'New conversation',
      date: new Date().toISOString(),
      messages: []
    };
    
    // Save to localStorage immediately
    const updatedConversations = [newConversation, ...conversations];
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));
    localStorage.setItem('activeConversationId', newConversationId);
    
    setConversations([...conversations, newConversation]);
    setActiveConversationId(newConversationId);
    setIsMobileMenuOpen(false);
  };
  
  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setIsMobileMenuOpen(false);
  };
  
  const handleClearChat = () => {
    if (!activeConversationId) return;
    
    setConversations(prevConversations => 
      prevConversations.map(conv => 
        conv.id === activeConversationId 
          ? { ...conv, messages: [] } 
          : conv
      )
    );
  };
  
  const extractTablesFromMessages = (messages: Message[]) => {
    const tables: any[][] = [];
    
    messages.forEach(message => {
      if (message.sender === 'ai' && message.structuredData?.tables) {
        tables.push(...message.structuredData.tables);
      }
      // Also check for table data in the structured data
      if (message.structuredData?.data && typeof message.structuredData.data === 'object') {
        Object.entries(message.structuredData.data).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            tables.push(value);
          }
        });
      }
    });
    
    return tables;
  };

  const handleJsonExport = () => {
    if (!activeConversation) return;
    
    const conversationData = JSON.stringify(activeConversation, null, 2);
    const blob = new Blob([conversationData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${activeConversation.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    URL.revokeObjectURL(url);
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 overflow-hidden pt-16">
        {/* Sidebar - Conversation List */}
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block md:w-80 lg:w-96 flex-shrink-0 h-full`}>
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full">
          {activeConversation && (
            <>
              <ChatHeader
                title={activeConversation.title}
                onClearChat={handleClearChat}
                onExportChat={handleExportChat}
              />
              <ChatContainer
                messages={activeConversation.messages.map(msg => ({
                  ...msg,
                  onFilterApply: async (filterQuery: string) => {
                    setIsLoading(true);
                    try {
                      const response = await chatApi.sendMessage(filterQuery);
                      
                      // Update the current conversation with the new filtered results
                      setConversations(prevConversations =>
                        prevConversations.map(conv =>
                          conv.id === activeConversationId
                            ? {
                                ...conv,
                                messages: conv.messages.map(m =>
                                  m.id === msg.id
                                    ? {
                                        ...m,
                                        structuredData: {
                                          summary: response.data?.summary || '',
                                          key_insights: response.data?.key_insights || [],
                                          data: response.data?.data || {}
                                        }
                                      }
                                    : m
                                )
                              }
                            : conv
                        )
                      );
                    } catch (error) {
                      console.error('Error updating filters:', error);
                    } finally {
                      setIsLoading(false);
                    }
                  }
                }))}
                isLoading={isLoading}
              />
              <div className="relative">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                />
                
                {/* User profile button in bottom left */}
                <div className="absolute left-4 bottom-20 z-10">
                  <button 
                    onClick={toggleUserMenu}
                    className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                  >
                    <User size={20} />
                  </button>
                  
                  {/* User menu dropdown */}
                  {userMenuOpen && (
                    <div className="absolute bottom-12 left-0 bg-white rounded-lg shadow-lg py-2 w-48">
                      <div className="px-4 py-2 border-b">
                        <p className="font-medium">User Profile</p>
                        <p className="text-sm text-gray-500">user@example.com</p>
                      </div>
                      <ul>
                        <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Settings</li>
                        <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Help & Support</li>
                        <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-600">Sign Out</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;