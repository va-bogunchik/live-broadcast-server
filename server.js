const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Разрешаем подключение с любого сайта (Netlify)
    methods: ["GET", "POST"]
  }
});

// Хранилище комнат в памяти
const rooms = {};

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Вход в комнату
  socket.on('join-room', ({ roomCode, isHost }) => {
    socket.join(roomCode);
    
    if (!rooms[roomCode]) {
      rooms[roomCode] = { host: isHost ? socket.id : null };
    }

    // Сообщаем всем в комнате, что кто-то зашел
    socket.to(roomCode).emit('user-joined', socket.id);
    console.log(`Пользователь ${socket.id} зашел в комнату ${roomCode}`);
  });

  // Синхронизация видео (Play, Pause, Перемотка)
  socket.on('sync-video', ({ roomCode, data }) => {
    socket.to(roomCode).emit('sync-video', data);
  });

  // Чат
  socket.on('chat-message', ({ roomCode, text, sender }) => {
    socket.to(roomCode).emit('chat-message', { text, sender });
  });

  // Реакции
  socket.on('reaction', ({ roomCode, emoji }) => {
    socket.to(roomCode).emit('reaction', emoji);
  });

  // Выход из комнаты
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});