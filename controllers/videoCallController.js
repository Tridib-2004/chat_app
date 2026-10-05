const VIDEO_ROOM_PREFIX = 'video-call:';
const MAX_CALL_PARTICIPANTS = 6;

function getCallParticipants(sockets) {
  return sockets.map((participant) => ({
    id: participant.id,
    username: participant.username
  }));
}

function registerVideoCallHandlers(io, socket) {
  async function leaveVideoCall() {
    const videoRoom = socket.data.videoRoom;
    if (!videoRoom) return;

    socket.data.videoRoom = null;
    await socket.leave(videoRoom);
    io.to(videoRoom).emit('video call participant left', { id: socket.id });
    const remaining = await io.in(videoRoom).fetchSockets();
    io.to(videoRoom).emit('video call participants changed', getCallParticipants(remaining));
  }

  socket.on('video call join', async () => {
    if (socket.data.videoRoom) return;

    const videoRoom = `${VIDEO_ROOM_PREFIX}${socket.roomName}`;
    const existing = await io.in(videoRoom).fetchSockets();
    if (existing.length >= MAX_CALL_PARTICIPANTS) {
      socket.emit('video call error', 'This room call is full.');
      return;
    }

    await socket.join(videoRoom);
    socket.data.videoRoom = videoRoom;
    const participants = getCallParticipants(existing);
    socket.emit('video call joined', {
      id: socket.id,
      username: socket.username,
      roomName: socket.roomName
    });
    socket.emit('video call participants', participants);
    for (const participant of existing) {
      io.to(participant.id).emit('video call participant joined', {
        participant: { id: socket.id, username: socket.username }
      });
    }
    io.to(videoRoom).emit('video call participants changed', [
      ...participants,
      { id: socket.id, username: socket.username }
    ]);
  });

  socket.on('video call signal', (signal) => {
    const videoRoom = socket.data.videoRoom;
    if (!videoRoom || !signal || typeof signal.to !== 'string') return;

    const target = io.sockets.sockets.get(signal.to);
    if (!target || target.data.videoRoom !== videoRoom) return;

    if (signal.description && ['offer', 'answer'].includes(signal.description.type)
      && typeof signal.description.sdp === 'string'
      && signal.description.sdp.length <= 200000) {
      target.emit('video call signal', {
        from: socket.id,
        username: socket.username,
        description: signal.description
      });
      return;
    }

    if (signal.candidate && typeof signal.candidate.candidate === 'string'
      && signal.candidate.candidate.length <= 8192) {
      target.emit('video call signal', {
        from: socket.id,
        username: socket.username,
        candidate: signal.candidate
      });
    }
  });

  socket.on('video call leave', leaveVideoCall);
  return leaveVideoCall;
}

module.exports = registerVideoCallHandlers;