import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css';
import './Message.css';
import ResultTable from './ResultTable';
import { Bot, User } from 'lucide-react';

const Message = ({ message }) => {
  const { type, content, responseType, structuredData } = message;

  useEffect(() => {
    console.log('=== Message Props ===', {
      type,
      content,
      responseType,
      structuredData
    });
  }, [type, content, responseType, structuredData]);

  const renderMarkdown = (content) => (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="table-container overflow-auto">
              <table className="table-auto border-collapse border border-gray-300 w-full" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gray-200" {...props} />,
          th: ({ node, ...props }) => <th className="border p-2 text-left" {...props} />,
          td: ({ node, ...props }) => <td className="border p-2" {...props} />,
          tr: ({ node, ...props }) => <tr className="hover:bg-gray-100" {...props} />,
          code: ({ node, inline, ...props }) => (
            <code className={inline ? 'inline-code' : 'code-block'} {...props} />
          ),
          pre: ({ node, ...props }) => <pre className="code-block" {...props} />
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );

  const renderContent = () => {
    if (type === 'user') {
      return <div className="whitespace-pre-wrap text-right">{content}</div>;
    }

    console.log('=== Rendering Bot Response ===', {
      responseType,
      hasStructuredData: !!structuredData,
      content
    });

    if (responseType === 'structured' && structuredData) {
      console.log('=== Rendering Structured Data ===');
      return (
        <div className="space-y-4">
          {structuredData.summary && (
            <div className="text-sm text-gray-600">{structuredData.summary}</div>
          )}
          <ResultTable data={structuredData} />
        </div>
      );
    }

    // Handle markdown or fallback to plain text with markdown parsing
    return renderMarkdown(content);
  };

  return (
    <div className={`${type === 'user' ? 'user-message' : 'bot-message'} p-4`}>
      <div className="flex items-start gap-3">
        {type === 'bot' && (
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
              AI
            </div>
          </div>
        )}
        <div className={`flex-grow ${type === 'user' ? 'ml-auto' : ''}`}>
          <div className="text-sm">{renderContent()}</div>
        </div>
        {type === 'user' && (
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-sm font-medium">
              You
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
