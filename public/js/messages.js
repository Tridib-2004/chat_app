import { dom, socket, state } from './state.js';

export function scrollToLatest() {
    dom.conversation.scrollTop = dom.conversation.scrollHeight;
}

export function addMessage(message) {
    const item = document.createElement('li');
    item.className = `message${message.senderId === socket.id ? ' own' : ''}`;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (message.username || '?').charAt(0).toUpperCase();

    const content = document.createElement('div');
    content.className = 'message-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const author = document.createElement('span');
    author.className = 'message-author';
    author.textContent = message.username || 'Anonymous';
    const time = document.createElement('time');
    const date = new Date(message.timestamp);
    time.className = 'message-time';
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.message;
    meta.append(author, time);
    content.append(meta, text);
    item.append(avatar, content);
    dom.messages.appendChild(item);
    dom.conversation.classList.add('has-messages');
    scrollToLatest();
}

export function renderTyping() {
    const names = [...state.typingUsers.values()];
    if (names.length === 0) dom.typingIndicator.textContent = '';
    else if (names.length === 1) dom.typingIndicator.textContent = `${names[0]} is typing...`;
    else if (names.length === 2) dom.typingIndicator.textContent = `${names[0]} and ${names[1]} are typing...`;
    else dom.typingIndicator.textContent = 'Several people are typing...';
}

export function stopTyping() {
    clearTimeout(state.typingTimeout);
    if (socket.connected) socket.emit('typing', false);
}

export function clearTyping() {
    state.typingUsers.clear();
    renderTyping();
}

export function initMessages() {
    dom.messageForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = dom.messageInput.value.trim();
        if (!message || !socket.connected) return;
        stopTyping();
        socket.emit('chat message', message);
        dom.messageInput.value = '';
        dom.messageInput.style.height = '39px';
    });

    dom.messageInput.addEventListener('input', () => {
        dom.messageInput.style.height = '39px';
        dom.messageInput.style.height = `${Math.min(dom.messageInput.scrollHeight, 120)}px`;
        clearTimeout(state.typingTimeout);
        if (dom.messageInput.value.trim()) {
            socket.emit('typing', true);
            state.typingTimeout = setTimeout(stopTyping, 1400);
        } else {
            stopTyping();
        }
    });

    dom.messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            dom.messageForm.requestSubmit();
        }
    });
}
