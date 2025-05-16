import React from 'react';
import { countries } from '../utils/helpers';

const TripDetails = ({ data, isSearchResult, isModified }) => {
  // Создание строк с параметрами
  const DetailRow = ({ label, value }) => {
    if (!value && value !== 0) return null;
    
    return (
      <div className="flex mb-1">
        <span className="font-semibold min-w-[130px]">{label}:</span>
        <span>{value}</span>
      </div>
    );
  };
  
  // Формируем человекочитаемое название направления
  const getDestination = () => {
    if (!data.to_country) return null;
    
    const countryName = countries[data.to_country] || data.to_country;
    return countryName + (data.to_city ? `, ${data.to_city}` : '');
  };
  
  return (
    <div>
      {/* Сообщение */}
      {data.message && (
        <p className="mb-3">{data.message}</p>
      )}
      
      {/* Если новый поиск, показываем вводное сообщение */}
      {isSearchResult && !data.message && (
        <p className="mb-3">Я нашёл следующие параметры для вашего запроса:</p>
      )}
      
      {/* Детали тура */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-2">
        <DetailRow label="Направление" value={getDestination()} />
        <DetailRow label="Вылет из" value={data.from_city} />
        <DetailRow label="Дата вылета" value={data.start_date} />
        <DetailRow label="Ночей" value={data.nights} />
        <DetailRow label="Взрослых" value={data.adults} />
        
        {data.kids > 0 && (
          <>
            <DetailRow label="Детей" value={data.kids} />
            {data.kids_ages && data.kids_ages.length > 0 && (
              <DetailRow label="Возраст детей" value={data.kids_ages.join(', ')} />
            )}
          </>
        )}
      </div>
      
      {/* Подсказка для дальнейших действий */}
      <p className="text-sm text-gray-600">
        Хотите изменить какие-то параметры? Например: "Измени дату на октябрь" или "Поменяй страну на Грецию".
      </p>
    </div>
  );
};

export default TripDetails; 