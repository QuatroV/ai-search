import React from 'react';
import Message from './Message';
import TypingIndicator from './TypingIndicator';

const MessageList = ({ messages, isTyping, messagesEndRef }) => {
  return (
    <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
      {messages.map((message, index) => (
        <Message 
          key={index} 
          type={message.type} 
          content={message.content}
          action={message.action}
        />
      ))}
      
      {isTyping && <TypingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 