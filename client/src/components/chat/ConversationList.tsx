import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import format from 'date-fns/format';
import isToday from 'date-fns/isToday';
import isYesterday from 'date-fns/isYesterday';
import isThisWeek from 'date-fns/isThisWeek';
import parseISO from 'date-fns/parseISO';

interface Conversation {
  id: string;
  title: string;
  date: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

type GroupedConversations = {
  today: Conversation[];
  yesterday: Conversation[];
  thisWeek: Conversation[];
  older: Conversation[];
};

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation
}) => {
  const groupedConversations = useMemo(() => {
    const groups: GroupedConversations = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    conversations.forEach(conversation => {
      try {
        const date = parseISO(conversation.date);
        if (isToday(date)) {
          groups.today.push(conversation);
        } else if (isYesterday(date)) {
          groups.yesterday.push(conversation);
        } else if (isThisWeek(date)) {
          groups.thisWeek.push(conversation);
        } else {
          groups.older.push(conversation);
        }
      } catch (error) {
        console.error('Error parsing date:', error);
        groups.older.push(conversation);
      }
    });

    const sortByDate = (a: Conversation, b: Conversation) => 
      parseISO(b.date).getTime() - parseISO(a.date).getTime();

    groups.today.sort(sortByDate);
    groups.yesterday.sort(sortByDate);
    groups.thisWeek.sort(sortByDate);
    groups.older.sort(sortByDate);

    return groups;
  }, [conversations]);

  const formatDate = (date: string) => {
    try {
      const parsedDate = parseISO(date);
      if (isToday(parsedDate)) {
        return format(parsedDate, 'h:mm a');
      } else if (isYesterday(parsedDate)) {
        return 'Yesterday';
      } else if (isThisWeek(parsedDate)) {
        return format(parsedDate, 'EEEE');
      } else {
        return format(parsedDate, 'MMM d, yyyy');
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const renderConversation = (conversation: Conversation) => (
    <li key={conversation.id} className="pl-6 pr-4 py-2 rounded-md cursor-pointer hover:bg-gray-100 flex items-center justify-between">
      <button
        onClick={() => onSelectConversation(conversation.id)}
        className={`flex-1 text-left ${
          activeConversation === conversation.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
        } p-2 rounded-md`}
      >
        <div className="font-medium truncate">{conversation.title}</div>
        <div className="text-xs text-gray-500">{formatDate(conversation.date)}</div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteConversation(conversation.id);
        }}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200"
        title="Delete conversation"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 border-r">
      <div className="p-4">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus size={18} />
          <span>New Conversation</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {groupedConversations.today.length > 0 && (
          <div className="mb-4">
            <h2 className="px-6 py-2 text-sm font-medium text-gray-500">Today</h2>
            <ul className="space-y-1">{groupedConversations.today.map(renderConversation)}</ul>
          </div>
        )}

        {groupedConversations.yesterday.length > 0 && (
          <div className="mb-4">
            <h2 className="px-6 py-2 text-sm font-medium text-gray-500">Yesterday</h2>
            <ul className="space-y-1">{groupedConversations.yesterday.map(renderConversation)}</ul>
          </div>
        )}

        {groupedConversations.thisWeek.length > 0 && (
          <div className="mb-4">
            <h2 className="px-6 py-2 text-sm font-medium text-gray-500">This Week</h2>
            <ul className="space-y-1">{groupedConversations.thisWeek.map(renderConversation)}</ul>
          </div>
        )}

        {groupedConversations.older.length > 0 && (
          <div>
            <h2 className="px-6 py-2 text-sm font-medium text-gray-500">Older</h2>
            <ul className="space-y-1">{groupedConversations.older.map(renderConversation)}</ul>
          </div>
        )}

        {conversations.length === 0 && (
          <div className="px-6 py-3 text-sm text-gray-500">No conversations yet</div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
