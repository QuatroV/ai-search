import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import { generateSessionId } from './utils/helpers';

function App() {
  const [messages, setMessages] = useState([
    { 
      type: 'bot', 
      content: 'Привет! Я могу помочь найти вам тур. Опишите, куда бы вы хотели поехать, например: "Туры в Турцию в сентябре" или "Горящие туры в Египет на двоих с ребенком".'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionData, setSessionData] = useState({
    sessionId: generateSessionId(),
    currentParams: null
  });
  
  const messagesEndRef = useRef(null);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    // Добавляем сообщение пользователя
    setMessages(prevMessages => [
      ...prevMessages, 
      { type: 'user', content: text }
    ]);

    // Показываем индикатор печати
    setIsTyping(true);

    try {
      // Отправляем запрос на сервер
      const response = await fetch('/chat-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          sessionId: sessionData.sessionId,
          currentParams: sessionData.currentParams
        })
      });

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
      }

      const data = await response.json();

      // Обновляем данные сессии
      setSessionData(prev => ({
        sessionId: data.sessionId || prev.sessionId,
        currentParams: (data.action === 'SEARCH_RESULTS' || data.action === 'PARAMS_MODIFIED') 
          ? { ...data } 
          : prev.currentParams
      }));

      // Добавляем ответ бота
      setMessages(prevMessages => [
        ...prevMessages,
        { 
          type: 'bot', 
          content: data,
          action: data.action 
        }
      ]);
    } catch (error) {
      // Обработка ошибки - пробуем запасной API
      try {
        const response = await fetch('/parse-trip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          throw error; // Используем оригинальную ошибку
        }

        const data = await response.json();
        
        setMessages(prevMessages => [
          ...prevMessages,
          { 
            type: 'bot', 
            content: data,
            action: data.action || 'SEARCH_RESULTS'
          }
        ]);

      } catch (fallbackError) {
        setMessages(prevMessages => [
          ...prevMessages,
          { 
            type: 'bot', 
            content: `Извините, произошла ошибка: ${error.message}`,
            action: 'ERROR'
          }
        ]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="max-w-3xl w-full mx-auto flex flex-col h-screen bg-white shadow-md">
        <ChatHeader />
        <MessageList 
          messages={messages} 
          isTyping={isTyping} 
          messagesEndRef={messagesEndRef} 
        />
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}

export default App; 