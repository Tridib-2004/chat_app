import { dom, socket, state } from './state.js';
import { addMessage, clearTyping, renderTyping } from './messages.js';
import { addAttachment, clearUploadToken, updateUploadToken } from './uploads.js';
import { renderMembers } from './rooms.js';

export function initSocketEvents({ onRoomJoined, onVideoCallDisconnect }) {
    socket.on('connect', () => {
        dom.connection.dataset.state = 'online';
        dom.connectionText.textContent = 'Connected';
        socket.emit('set username', dom.usernameInput.value.trim() || 'Anonymous');
        socket.emit('join room', state.activeRoom);
    });

    socket.on('upload token', updateUploadToken);
    socket.on('video call config', (config) => {
        if (Array.isArray(config.iceServers) && config.iceServers.length) {
            state.iceServers = config.iceServers;
        }
    });

    socket.on('disconnect', () => {
        dom.connection.dataset.state = 'offline';
        dom.connectionText.textContent = 'Reconnecting';
        clearUploadToken();
        clearTyping();
        onVideoCallDisconnect();
    });

    socket.on('room joined', onRoomJoined);
    socket.on('room users', renderMembers);
    socket.on('typing update', ({ id, username, isTyping }) => {
        if (id === socket.id) return;
        if (isTyping) state.typingUsers.set(id, username);
        else state.typingUsers.delete(id);
        renderTyping();
    });

    socket.on('chat message', addMessage);
    socket.on('file shared', addAttachment);
}
