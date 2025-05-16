# Tour Request Parser API

A Node.js + Express server with React frontend that uses the Ollama Llama3 model to convert natural language tour requests into structured JSON.

## Prerequisites

- Node.js and npm installed
- Ollama installed with Llama3 model

## Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the Llama3 model:
   ```
   ollama pull llama3
   ```
3. Install all dependencies (server and client):
   ```
   npm run install-all
   ```

## Running the Application

### Development Mode (both server and client)

Start Ollama in one terminal:

```
ollama serve
```

Start the server and client together in another terminal:

```
npm run dev-full
```

This will run:

- Backend API server at http://localhost:3000
- React development server at http://localhost:3001

### Production Mode

Build the React client:

```
npm run build
```

Start the server:

```
npm start
```

The application will run at http://localhost:3000 with the React app served as static files.

## Architecture

### Backend

The backend is a Node.js + Express server that:

1. Uses Ollama's Llama3 model to detect user intent
2. Extracts tour parameters from natural language
3. Supports modifying existing parameters
4. Maintains session state for each user

### Frontend

The frontend is a React application with Tailwind CSS that:

1. Provides a chat-like interface for user interaction
2. Formats tour parameters in a readable format
3. Shows typing indicators and animations
4. Maintains session state across messages

## API Usage

### Chat API

Send a POST request to `/chat-api` with a JSON body:

```json
{
  "text": "Туры в турцию в сентябре",
  "sessionId": "optional_session_id",
  "currentParams": null
}
```

### Legacy API

Send a POST request to `/parse-trip` with a JSON body:

```json
{
  "text": "Туры в турцию в сентябре"
}
```

## Example Response

```json
{
  "action": "SEARCH_RESULTS",
  "to_country": "TR",
  "to_city": "Antalya",
  "from_city": "Moscow",
  "from_country": "RU",
  "adults": 2,
  "kids": 0,
  "kids_ages": [],
  "start_date": "01.09.2025",
  "nights": 7,
  "sessionId": "session_abc123"
}
```
# ai-search
