const assert = require('node:assert/strict');
const test = require('node:test');
const registerVideoCallHandlers = require('../controllers/videoCallController');

class FakeSocket {
  constructor(id, roomName, io) {
    this.id = id;
    this.username = id;
    this.roomName = roomName;
    this.data = {};
    this.io = io;
    this.handlers = new Map();
    this.received = [];
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  emit(event, payload) {
    this.received.push({ event, payload });
  }

  async join(roomName) {
    this.io.addToRoom(roomName, this.id);
  }

  async leave(roomName) {
    this.io.rooms.get(roomName)?.delete(this.id);
  }

  async trigger(event, payload) {
    return this.handlers.get(event)(payload);
  }
}

class FakeIo {
  constructor() {
    this.sockets = { sockets: new Map() };
    this.rooms = new Map();
  }

  addToRoom(roomName, socketId) {
    if (!this.rooms.has(roomName)) this.rooms.set(roomName, new Set());
    this.rooms.get(roomName).add(socketId);
  }

  in(roomName) {
    return {
      fetchSockets: async () => [...(this.rooms.get(roomName) || [])]
        .map((socketId) => this.sockets.sockets.get(socketId))
    };
  }

  to(target) {
    return {
      emit: (event, payload) => {
        const recipients = this.rooms.get(target);
        if (recipients) {
          recipients.forEach((socketId) => this.sockets.sockets.get(socketId).emit(event, payload));
        } else {
          this.sockets.sockets.get(target)?.emit(event, payload);
        }
      }
    };
  }
}

test('video signaling is restricted to the same room call', async () => {
  const io = new FakeIo();
  const alice = new FakeSocket('alice', 'general', io);
  const bob = new FakeSocket('bob', 'general', io);
  const mallory = new FakeSocket('mallory', 'private', io);
  [alice, bob, mallory].forEach((socket) => {
    io.sockets.sockets.set(socket.id, socket);
    registerVideoCallHandlers(io, socket);
  });

  await alice.trigger('video call join');
  await bob.trigger('video call join');
  await mallory.trigger('video call join');
  alice.received.length = 0;
  bob.received.length = 0;
  mallory.received.length = 0;

  await alice.trigger('video call signal', {
    to: bob.id,
    description: { type: 'offer', sdp: 'local-offer' }
  });
  await alice.trigger('video call signal', {
    to: mallory.id,
    description: { type: 'offer', sdp: 'cross-room-offer' }
  });

  assert.deepEqual(bob.received, [{
    event: 'video call signal',
    payload: {
      from: alice.id,
      username: alice.username,
      description: { type: 'offer', sdp: 'local-offer' }
    }
  }]);
  assert.equal(mallory.received.length, 0);

  await bob.trigger('video call leave');
  assert.equal(bob.data.videoRoom, null);
  assert.equal(alice.received.at(-1).event, 'video call participants changed');
  assert.deepEqual(alice.received.at(-1).payload.map((participant) => participant.id), ['alice']);
});
