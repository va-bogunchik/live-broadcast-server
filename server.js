const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// Разрешаем запросы с любых доменов (для Netlify, Vercel, GitHub Pages и т.д.)
app.use(cors());

// Простой маршрут для проверки работоспособности сервера (Health check)
app.get('/', (req, res) => {
    res.send('Live Broadcast Server is running!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // В продакшене лучше указать конкретный домен: ['https://твой-сайт.netlify.app']
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Хранилище для активных комнат (если нужно отслеживать хоста, но Socket.io делает большую часть работы сам)
const rooms = {};

io.on('connection', (socket) => {
    console.log('Пользователь подключен:', socket.id);

    // ==========================================
    // 1. ПОДКЛЮЧЕНИЕ К КОМНАТЕ
    // ==========================================
    socket.on('join-room', ({ roomCode, isHost }) => {
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isHost = isHost;

        if (!rooms[roomCode]) {
            rooms[roomCode] = { users: [] };
        }
        rooms[roomCode].users.push(socket.id);

        console.log(`Пользователь ${socket.id} (Хост: ${isHost}) вошел в комнату ${roomCode}`);
        
        // Сообщаем всем в комнате, что кто-то подключился (если это гость, хост начнет синхронизацию)
        socket.to(roomCode).emit('user-joined');
    });

    // ==========================================
    // 2. СИНХРОНИЗАЦИЯ ВИДЕО (YouTube и др.)
    // ==========================================
    socket.on('sync-video', (data) => {
        // Пересылаем данные о видео (Play, Pause, перемотка, качество, громкость) всем, кроме отправителя
        socket.to(data.roomCode).emit('sync-video', data.data);
    });

    // ==========================================
    // 3. WEBRTC СИГНАЛИНГ (ДЕМОНСТРАЦИЯ ЭКРАНА)
    // ==========================================
    socket.on('webrtc-offer', (data) => {
        socket.to(data.roomCode).emit('webrtc-offer', data.offer);
    });

    socket.on('webrtc-answer', (data) => {
        socket.to(data.roomCode).emit('webrtc-answer', data.answer);
    });

    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.roomCode).emit('webrtc-ice-candidate', data.candidate);
    });

    socket.on('screen-share-start', ({ roomCode }) => {
        socket.to(roomCode).emit('screen-share-start');
    });

    socket.on('screen-share-stop', ({ roomCode }) => {
        socket.to(roomCode).emit('screen-share-stop');
    });

    // ==========================================
    // 4. ЧАТ
    // ==========================================
    socket.on('chat-message', (data) => {
        socket.to(data.roomCode).emit('chat-message', data);
    });

    // ==========================================
    // 5. ОЧЕРЕДЬ И УПРАВЛЕНИЕ ХОСТОМ
    // ==========================================
    socket.on('queue', (data) => {
        socket.to(data.roomCode).emit('queue', data.queue);
    });

    socket.on('next-video', (data) => {
        socket.to(data.roomCode).emit('next-video', data);
    });

    socket.on('host-control', (data) => {
        socket.to(data.roomCode).emit('host-control', data);
    });

    // ==========================================
    // 6. ОТКЛЮЧЕНИЕ
    // ==========================================
    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
        
        if (socket.roomCode && rooms[socket.roomCode]) {
            // Удаляем пользователя из списка
            rooms[socket.roomCode].users = rooms[socket.roomCode].users.filter(id => id !== socket.id);
            
            // Сообщаем оставшимся, что партнер ушел
            socket.to(socket.roomCode).emit('user-left');

            // Если в комнате никого не осталось, удаляем её
            if (rooms[socket.roomCode].users.length === 0) {
                delete rooms[socket.roomCode];
                console.log(`Комната ${socket.roomCode} удалена (пуста)`);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
