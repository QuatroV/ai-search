const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Получение локальных IP-адресов
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const ifaceName in interfaces) {
    for (const iface of interfaces[ifaceName]) {
      // Пропускаем внутренние и не IPv4 адреса
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  return addresses;
}

// Middleware for parsing JSON - explicitly configure options
app.use(bodyParser.json({ 
  limit: '10mb',
  strict: false,  // Less strict JSON parsing
  type: 'application/json'
}));

// Also support URL-encoded bodies
app.use(bodyParser.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.is('application/json')) {
    console.log('Request body:', JSON.stringify(req.body));
  }
  next();
});

// Simple test API endpoint
app.post('/api/test', (req, res) => {
  console.log('Received test request:', req.body);
  res.json({
    success: true,
    message: 'API is working',
    receivedText: req.body.text || 'No text provided'
  });
});

// API для внешних запросов
app.post('/api/parse', async (req, res) => {
  console.log('Received parse request:', req.body);
  const text = req.body?.text;
  
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }
  
  try {
    const result = await handleSearchTour(text);
    console.log('Sending response:', result);
    return res.json(result);
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ 
      error: 'processing_error', 
      message: err.message 
    });
  }
});

// Маршрут для старого API (оставляем для обратной совместимости)
app.post('/parse-trip', async (req, res) => {
  try {
    const result = await handleSearchTour(req.body.text);
    res.json(result);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'LLM error', details: err.message });
  }
});

// Маршрут для чат-API
app.post('/chat-api', async (req, res) => {
  const { text, sessionId, currentParams } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  // Создаем или получаем существующую сессию
  const sessionKey = sessionId || 'default';
  if (!userSessions[sessionKey] && currentParams) {
    userSessions[sessionKey] = { params: currentParams };
  } else if (!userSessions[sessionKey]) {
    userSessions[sessionKey] = { params: null };
  }

  try {
    // Определяем интент пользователя с помощью ИИ
    const intent = await detectIntent(text, userSessions[sessionKey].params);

    let response;
    
    // Обрабатываем сообщение в зависимости от интента
    switch (intent.type) {
      case 'SEARCH_TOUR':
        response = await handleSearchTour(text);
        userSessions[sessionKey].params = response; // Сохраняем параметры поиска
        break;
        
      case 'MODIFY_PARAMS':
        response = await handleModifyParams(text, userSessions[sessionKey].params, intent.modificationType);
        userSessions[sessionKey].params = response; // Обновляем параметры
        break;

      case 'GREETING':
        response = {
          action: 'GREETING',
          message: 'Привет! Я могу помочь вам найти подходящий тур. Просто скажите, куда бы вы хотели поехать.'
        };
        break;
        
      case 'HELP':
        response = {
          action: 'HELP',
          message: 'Я могу помочь найти тур по вашим пожеланиям. Например, вы можете сказать "Хочу в Турцию в августе" или "Измени дату на сентябрь". Что бы вы хотели найти?'
        };
        break;
        
      default:
        response = {
          action: 'UNKNOWN',
          message: 'Извините, я не совсем понял, что вы имеете в виду. Вы можете уточнить, куда бы вы хотели поехать?'
        };
    }
    
    response.sessionId = sessionKey;
    res.json(response);
    
  } catch (err) {
    console.error('Ошибка при обработке сообщения:', err);
    res.status(500).json({ 
      error: 'processing_error', 
      message: 'Произошла ошибка при обработке вашего запроса',
      details: err.message 
    });
  }
});

// ПОСЛЕ определения всех API маршрутов обслуживаем статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Обслуживаем React-приложение из папки client/build, если она существует
try {
  const clientBuildPath = path.join(__dirname, 'client', 'build');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    console.log('Serving React client from build directory');
  }
} catch (err) {
  console.log('Client build directory not found, serving default static files');
}

// Хранилище состояний пользовательских сессий
const userSessions = {};

// Определение интента пользователя с помощью ИИ
async function detectIntent(text, currentParams) {
  // Если у нас нет текущих параметров, вероятно это первый запрос - считаем, что это поиск
  if (!currentParams) {
    return { type: 'SEARCH_TOUR' };
  }
  
  const prompt = `Ты система определения намерений пользователя в чат-боте для поиска туров.
  
Проанализируй сообщение пользователя и определи его намерение (интент).
Верни ТОЛЬКО JSON без дополнительных пояснений в следующем формате:

{
  "type": "ТИП_ИНТЕНТА",
  "modificationType": "ТИП_МОДИФИКАЦИИ" // (если применимо)
}

Возможные типы интентов (type):
- "GREETING" - приветствие, например "привет", "здравствуй", "добрый день"
- "HELP" - запрос помощи, например "помоги", "что ты умеешь", "как пользоваться"
- "SEARCH_TOUR" - запрос на поиск тура, например "хочу в турцию", "найди тур в испанию", "тур для двоих"
- "MODIFY_PARAMS" - запрос на изменение параметров, например "измени дату", "поменяй количество человек", "а если в октябре?"

Если тип интента - "MODIFY_PARAMS", укажи в поле "modificationType" что именно пользователь хочет изменить:
- "DATE" - дата поездки
- "DESTINATION" - место назначения (страна, город)
- "DURATION" - продолжительность поездки (количество ночей)
- "ADULTS" - количество взрослых
- "KIDS" - информация о детях (количество, возраст)
- "GENERAL" - общее изменение или несколько параметров одновременно

Текущие параметры поиска пользователя:
${JSON.stringify(currentParams, null, 2)}

Запрос пользователя: "${text}"`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt,
        stream: false
      })
    });

    const data = await response.json();
    const raw = data.response;

    // Попытка распарсить JSON из текста
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log("Не удалось распарсить ответ ИИ для определения интента:", raw);
      return { type: 'SEARCH_TOUR' }; // Дефолтный интент, если не удалось распарсить
    }

    const parsedIntent = JSON.parse(match[0]);
    
    console.log("Распознанный интент:", parsedIntent);
    return {
      type: parsedIntent.type || 'SEARCH_TOUR',
      modificationType: parsedIntent.modificationType
    };
  } catch (err) {
    console.error("Ошибка при определении интента:", err);
    return { type: 'SEARCH_TOUR' }; // Дефолтный интент в случае ошибки
  }
}

// Обработка запроса на поиск тура
async function handleSearchTour(text) {
  const prompt = `Ты извлекаешь параметры тура из фразы. Верни ТОЛЬКО JSON в таком формате:

{
  "to_country": "код ISO-2 страны назначения",
  "to_city": "город назначения на английском языке",
  "from_city": "город отправления на английском языке",
  "from_country": "код ISO-2 страны отправления",
  "adults": число,
  "kids": число,
  "kids_ages": список чисел,
  "start_date": "дд.мм.гггг",
  "nights": число
}

В ОТВЕТЕ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON !!!
В ОТВЕТЕ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON !!!
В ОТВЕТЕ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON !!!

Если страна назначения (to_country) не указана в запросе, оставь поле to_country пустым.
Для других параметров, которые не удалось извлечь, оставь соответствующие поля пустыми или null.

Для дат учитывай, что сейчас ${Date.now()}. То есть если в запросе не указан год, то используй текущий год - ${new Date().getFullYear()}. Если в запросе указана дата, то используй её, если нет, то используй текущую дату + 14 дней. Выводи дату в формате дд.мм.гггг.

Если в запросе не указано откуда вылет, то выставь в поле from_city "Moscow", а в поле from_country "RU".

Если в запросе указано количество ночей, то используй его, если нет, то используй 7.

Если в запросе указано количество взрослых, то используй его, если нет, то используй 2.

Если в запросе указано количество детей, то используй его, если нет, то используй 0.

Если дети указаны, а возраст нет - выставь им по 7 лет в поле kids_ages.

Фраза: "${text}


В ОТВЕТЕ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON !!!
В ОТВЕТЕ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON !!!
В ОТВЕТЕ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON !!!"`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const raw = data.response;

    console.log('LLM Raw response:', raw);

    // Попытка распарсить JSON из текста
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('LLM did not return valid JSON');
    }

    const parsedJson = JSON.parse(match[0]);
    
    // Если страна назначения не указана, запросить у пользователя
    if (!parsedJson.to_country) {
      return {
        action: 'MISSING_DESTINATION',
        message: "Пожалуйста, укажите страну или место назначения"
      };
    }
    
    // Установка значений по умолчанию для отсутствующих параметров
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 14);
    
    const defaultStartDate = `${String(twoWeeksLater.getDate()).padStart(2, '0')}.${String(twoWeeksLater.getMonth() + 1).padStart(2, '0')}.${twoWeeksLater.getFullYear()}`;
    
    const result = {
      action: 'SEARCH_RESULTS',
      to_country: parsedJson.to_country,
      to_city: parsedJson.to_city || "",
      from_city: parsedJson.from_city || "Moscow",
      from_country: parsedJson.from_country || "RU",
      adults: parsedJson.adults || 2,
      kids: parsedJson.kids || 0,
      kids_ages: parsedJson.kids_ages || [],
      start_date: parsedJson.start_date || defaultStartDate,
      nights: parsedJson.nights || 7
    };
    
    return result;
  } catch (err) {
    console.error("Error in handleSearchTour:", err);
    // Return error-specific message
    return {
      action: 'ERROR',
      message: `Произошла ошибка при обработке запроса: ${err.message}`
    };
  }
}

// Обработка запроса на изменение параметров
async function handleModifyParams(text, currentParams, modificationType) {
  if (!currentParams || currentParams.action === 'MISSING_DESTINATION') {
    // Если нет текущих параметров, делаем обычный поиск
    return handleSearchTour(text);
  }

  const prompt = `Ты помогаешь изменить параметры тура на основе запроса пользователя.
  
Текущие параметры:
${JSON.stringify(currentParams, null, 2)}

Запрос пользователя: "${text}"

Верни обновленные параметры в том же JSON формате. Измени только те параметры, о которых явно говорит пользователь.
Тип изменения, который запрашивает пользователь: ${modificationType || 'GENERAL'}.

Для любых новых дат используй формат дд.мм.гггг.
Для стран используй ISO-2 коды.
Города пиши на английском языке.`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned status ${response.status}`);
    }

    const data = await response.json();
    const raw = data.response;

    console.log('LLM response for modification:', raw);

    // Попытка распарсить JSON из текста
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('LLM did not return valid JSON for parameter modification');
    }

    const updatedParams = JSON.parse(match[0]);
    
    // Добавляем действие и сообщение о типе изменения
    updatedParams.action = 'PARAMS_MODIFIED';
    
    // Добавляем сообщение о том, что было изменено
    switch (modificationType) {
      case 'DATE':
        updatedParams.message = `Я изменил дату на ${updatedParams.start_date}.`;
        break;
      case 'DESTINATION':
        const countries = {
          'TR': 'Турцию', 'EG': 'Египет', 'TH': 'Таиланд', 'ES': 'Испанию',
          'GR': 'Грецию', 'IT': 'Италию', 'FR': 'Францию', 'DE': 'Германию',
          'CY': 'Кипр', 'AE': 'ОАЭ', 'MV': 'Мальдивы', 'DO': 'Доминикану',
          'CU': 'Кубу', 'TN': 'Тунис'
        };
        const destination = countries[updatedParams.to_country] || updatedParams.to_country;
        updatedParams.message = `Я изменил направление на ${destination}${updatedParams.to_city ? `, ${updatedParams.to_city}` : ''}.`;
        break;
      case 'DURATION':
        updatedParams.message = `Я изменил продолжительность на ${updatedParams.nights} ночей.`;
        break;
      case 'ADULTS':
        updatedParams.message = `Я изменил количество взрослых на ${updatedParams.adults}.`;
        break;
      case 'KIDS':
        updatedParams.message = `Я изменил количество детей на ${updatedParams.kids}.`;
        break;
      default:
        updatedParams.message = "Я обновил параметры поиска.";
    }
    
    return updatedParams;
  } catch (error) {
    console.error("Error parsing updated parameters:", error);
    // Возвращаем оригинальные параметры с сообщением об ошибке
    return {
      ...currentParams,
      action: 'ERROR',
      message: "Извините, не удалось обновить параметры. Пожалуйста, попробуйте выразить ваш запрос иначе."
    };
  }
}

// Маршрут для главной страницы
app.get('/', (req, res) => {
  // Если есть клиентское приложение, оно обслуживается через static middleware
  // Если нет - отдаем стандартную HTML страницу
  const clientBuildPath = path.join(__dirname, 'client', 'build', 'index.html');
  if (fs.existsSync(clientBuildPath)) {
    res.sendFile(clientBuildPath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Любые другие маршруты для SPA приложения
app.get('*', (req, res) => {
  // Проверяем существование файла в публичной директории
  const publicPath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(publicPath) && !fs.lstatSync(publicPath).isDirectory()) {
    return res.sendFile(publicPath);
  }
  
  // Для SPA маршрутов отдаем index.html
  const clientBuildPath = path.join(__dirname, 'client', 'build', 'index.html');
  if (fs.existsSync(clientBuildPath)) {
    res.sendFile(clientBuildPath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Запуск сервера на всех интерфейсах (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Tour parser service running on port ${PORT}`);
  
  // Вывод доступных IP-адресов
  const localIPs = getLocalIPs();
  if (localIPs.length > 0) {
    console.log('Available on local network at:');
    localIPs.forEach(ip => {
      console.log(`  http://${ip}:${PORT}`);
      console.log(`  API endpoint (POST): http://${ip}:${PORT}/api/parse`);
      console.log(`  Test API endpoint (POST): http://${ip}:${PORT}/api/test`);
    });
    
    console.log('\nTo test the API, run this command:');
    console.log(`curl -X POST http://localhost:${PORT}/api/test -H "Content-Type: application/json" -d "{\\"text\\":\\"Test message\\"}"`);
  } else {
    console.log('No network interfaces detected for local access');
  }
});
