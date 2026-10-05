const registerVideoCallHandlers = require('./videoCallController');

async function updateRoomUsers(io, roomName) {
  const roomSockets = await io.in(roomName).fetchSockets();
  io.to(roomName).emit('room users', roomSockets.map((roomSocket) => ({
    id: roomSocket.id,
    username: roomSocket.username
  })));
}

function updateTyping(socket, isTyping) {
  if (socket.isTyping === isTyping) return;
  socket.isTyping = isTyping;
  socket.to(socket.roomName).emit('typing update', {
    id: socket.id,
    username: socket.username,
    isTyping
  });
}

function handleChatConnection(io, socket) {
  console.log('A user connected');
  const leaveVideoCall = registerVideoCallHandlers(io, socket);

  const turnUrls = String(process.env.TURN_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (turnUrls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }
  socket.emit('video call config', { iceServers });
  socket.emit('upload token', socket.data.uploadToken);
  socket.join(socket.roomName);
  socket.emit('room joined', socket.roomName);
  updateRoomUsers(io, socket.roomName);

  socket.on('join room', async (roomName) => {
    const nextRoom = typeof roomName === 'string'
      ? roomName.trim().replace(/\\s+/g, '-').toLowerCase().slice(0, 32)
      : '';
    if (!nextRoom || nextRoom === socket.roomName) return;

    await leaveVideoCall();
    updateTyping(socket, false);
    const previousRoom = socket.roomName;
    await socket.leave(previousRoom);
    socket.roomName = nextRoom;
    await socket.join(socket.roomName);
    socket.emit('room joined', socket.roomName);
    await Promise.all([
      updateRoomUsers(io, previousRoom),
      updateRoomUsers(io, nextRoom)
    ]);
  });

  socket.on('chat message', (message) => {
    if (typeof message !== 'string') return;
    const cleanMessage = message.trim().slice(0, 2000);
    if (!cleanMessage) return;

    io.to(socket.roomName).emit('chat message', {
      username: socket.username,
      senderId: socket.id,
      message: cleanMessage,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('set username', async (username) => {
    if (typeof username !== 'string') return;
    const cleanUsername = username.trim().slice(0, 24);
    if (!cleanUsername) return;
    updateTyping(socket, false);
    socket.username = cleanUsername;
    await updateRoomUsers(io, socket.roomName);
  });

  socket.on('typing', (isTyping) => {
    if (typeof isTyping === 'boolean') updateTyping(socket, isTyping);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    leaveVideoCall();
    updateTyping(socket, false);
    updateRoomUsers(io, socket.roomName);
  });
}

module.exports = handleChatConnection;
