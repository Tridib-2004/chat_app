require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const {Server} = require('socket.io');
const initializeSocket = require('./middleware/socketMiddleware');
const handleChatConnection = require('./controllers/chatController');
const createUploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./routes/authRoutes');
const { requireAuthentication } = require('./middleware/authMiddleware');

if (!process.env.CHAT_ACCESS_TOKEN) {
  throw new Error('CHAT_ACCESS_TOKEN must be configured in chat/.env.');
}

const server = http.createServer(app);
const io = new Server(server);
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/uploads', requireAuthentication, createUploadRoutes(io));

io.use(initializeSocket);
io.on('connection', (socket) => handleChatConnection(io, socket));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
