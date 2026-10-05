import { dom, socket, state } from './state.js';

export function initAuth({ onExit, onProfileReset }) {
    function enterChat() {
        dom.authGate.hidden = true;
        dom.chatApp.hidden = false;
        if (!socket.connected) socket.connect();
    }

    function showAuthGate(message = '') {
        onExit();
        socket.disconnect();
        dom.chatApp.hidden = true;
        dom.authGate.hidden = false;
        dom.authStatus.textContent = message;
    }

    async function restoreSession() {
        try {
            const response = await fetch('/api/auth/session');
            if (response.ok) enterChat();
            else showAuthGate();
        } catch {
            showAuthGate('Unable to reach the chat server. Try again.');
        }
    }

    dom.authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        dom.authSubmit.disabled = true;
        dom.authStatus.textContent = 'Checking token...';
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: dom.accessTokenInput.value })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not sign in.');
            dom.accessTokenInput.value = '';
            dom.authStatus.textContent = '';
            enterChat();
        } catch (error) {
            dom.authStatus.textContent = error.message || 'Could not sign in.';
            dom.accessTokenInput.select();
        } finally {
            dom.authSubmit.disabled = false;
        }
    });

    dom.signOutButton.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            localStorage.removeItem(state.nameStorageKey);
            onProfileReset();
            showAuthGate();
        }
    });

    socket.on('connect_error', (error) => {
        dom.connection.dataset.state = 'offline';
        dom.connectionText.textContent = 'Disconnected';
        if (error.message === 'Authentication required') {
            showAuthGate('Your session expired. Enter the shared token again.');
        }
    });

    return { restoreSession, showAuthGate };
}
