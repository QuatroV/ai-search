import React from 'react';
import TripDetails from './TripDetails';

const Message = ({ type, content, action }) => {
  // Определяем классы для сообщения в зависимости от типа
  const messageClass = `message ${type === 'user' ? 'user-message' : 'bot-message'}`;
  
  // Форматируем контент бота в зависимости от типа действия
  const renderBotContent = () => {
    // Если контент - просто строка
    if (typeof content === 'string') {
      return <p>{content}</p>;
    }

    // Для структурированных ответов API
    if (action) {
      switch (action) {
        case 'SEARCH_RESULTS':
          return <TripDetails data={content} isSearchResult={true} />;
          
        case 'PARAMS_MODIFIED':
          return <TripDetails data={content} isModified={true} />;
          
        case 'MISSING_DESTINATION':
          return <p>{content.message}</p>;
          
        case 'GREETING':
        case 'HELP':
        case 'UNKNOWN':
        case 'ERROR':
          return <p>{content.message}</p>;
          
        default:
          // Для любых других типов просто показываем сообщение или JSON
          return content.message ? 
            <p>{content.message}</p> : 
            <pre className="text-xs overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
      }
    }
    
    // Обработка данных в старом формате для обратной совместимости
    if (content.to_country) {
      return <TripDetails data={content} isSearchResult={true} />;
    }
    
    // Для всего остального просто выводим JSON
    return <pre className="text-xs overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
  };
  
  return (
    <div className={messageClass}>
      {type === 'user' ? content : renderBotContent()}
    </div>
  );
};

export default Message; 