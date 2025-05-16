import React, { useState, useRef, useEffect } from 'react';

const ChatInput = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  // Фокус на поле ввода при монтировании компонента
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <form 
      className="flex p-4 border-t border-gray-200 bg-white" 
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        className="flex-1 px-4 py-3 border border-gray-300 rounded-full outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        placeholder="Напишите ваш запрос..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        ref={inputRef}
      />
      <button
        type="submit"
        className="ml-3 w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary-dark text-white rounded-full transition-colors"
        disabled={!message.trim()}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"/>
        </svg>
      </button>
    </form>
  );
};

export default ChatInput; 