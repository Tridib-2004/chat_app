import { dom, socket, state } from './state.js';
import { scrollToLatest } from './messages.js';

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function addAttachment(attachment) {
    const item = document.createElement('li');
    item.className = `message${attachment.senderId === socket.id ? ' own' : ''}`;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (attachment.username || '?').charAt(0).toUpperCase();

    const content = document.createElement('div');
    content.className = 'message-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const author = document.createElement('span');
    author.className = 'message-author';
    author.textContent = attachment.username || 'Anonymous';
    const time = document.createElement('time');
    const date = new Date(attachment.timestamp);
    time.className = 'message-time';
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    meta.append(author, time);

    const card = document.createElement('div');
    card.className = 'attachment';
    if (attachment.previewUrl) {
        const image = document.createElement('img');
        image.className = 'attachment-preview';
        image.src = attachment.previewUrl;
        image.alt = attachment.fileName;
        image.loading = 'lazy';
        card.appendChild(image);
    }

    const link = document.createElement('a');
    link.className = 'attachment-link';
    link.href = attachment.downloadUrl;
    link.download = attachment.fileName;
    link.textContent = attachment.fileName;
    card.appendChild(link);

    const size = document.createElement('span');
    size.className = 'attachment-size';
    size.textContent = formatFileSize(attachment.fileSize);
    card.appendChild(size);
    content.append(meta, card);
    item.append(avatar, content);
    dom.messages.appendChild(item);
    dom.conversation.classList.add('has-messages');
    scrollToLatest();
}

export function initUploads() {
    dom.attachButton.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', async () => {
        const file = dom.fileInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            dom.uploadStatus.textContent = 'Files must be 10 MB or smaller.';
            dom.fileInput.value = '';
            return;
        }
        if (!socket.connected || !state.uploadToken) {
            dom.uploadStatus.textContent = 'Reconnect before uploading.';
            dom.fileInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('socketId', socket.id);
        formData.append('uploadToken', state.uploadToken);
        dom.attachButton.disabled = true;
        dom.uploadStatus.textContent = `Uploading ${file.name}...`;
        try {
            const response = await fetch('/api/uploads', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed.');
            dom.uploadStatus.textContent = '';
        } catch (error) {
            dom.uploadStatus.textContent = error.message || 'Upload failed. Try again.';
        } finally {
            dom.attachButton.disabled = false;
            dom.fileInput.value = '';
        }
    });
}

export function updateUploadToken(token) {
    state.uploadToken = token;
    dom.attachButton.disabled = false;
}

export function clearUploadToken() {
    state.uploadToken = '';
    dom.attachButton.disabled = true;
}
