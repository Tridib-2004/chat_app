import { dom, socket, state } from './state.js';

let joinRoomAction = () => {};
const roomDetails = {
    general: {
        image: '/images/room-collaboration.jpg',
        alt: 'Colleagues working around a shared table',
        description: 'An open space for day-to-day conversation.'
    },
    introductions: {
        image: '/images/room-introductions.jpg',
        alt: 'A group of friends standing together outdoors',
        description: 'A warm welcome for new faces.'
    },
    ideas: {
        image: '/images/room-ideas.jpg',
        alt: 'Colleagues sharing ideas around a sticky-note board',
        description: 'A place for plans, questions, and fresh thinking.'
    }
};

function getRoomDetails(roomName) {
    return roomDetails[roomName] || {
        image: roomDetails.general.image,
        alt: roomDetails.general.alt,
        description: 'A shared space for conversation and updates.'
    };
}

export function normalizeRoom(name) {
    return name.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 32);
}

export function updateAvatar() {
    const name = dom.usernameInput.value.trim();
    dom.profileAvatar.textContent = name ? name.charAt(0).toUpperCase() : 'Y';
}

export function renderRooms() {
    dom.roomList.replaceChildren();
    state.roomNames.forEach((roomName) => {
        const button = document.createElement('button');
        button.className = 'room-button';
        button.type = 'button';
        button.setAttribute('aria-current', String(roomName === state.activeRoom));
        const thumbnail = document.createElement('img');
        thumbnail.className = 'room-thumbnail';
        thumbnail.src = getRoomDetails(roomName).image;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        const label = document.createElement('span');
        label.textContent = roomName;
        button.append(thumbnail, label);
        button.addEventListener('click', () => joinRoomAction(roomName));
        dom.roomList.appendChild(button);
    });
}

export function renderRoomDetails(roomName = state.activeRoom) {
    const details = getRoomDetails(roomName);
    dom.roomCover.src = details.image;
    dom.roomCover.alt = details.alt;
    dom.roomDetailsTitle.textContent = `#${roomName}`;
    dom.roomDescription.textContent = details.description;
}

export function renderMembers(users) {
    dom.membersList.replaceChildren();
    dom.onlineCount.textContent = `${users.length} here`;
    users.forEach((user) => {
        const item = document.createElement('li');
        item.className = 'member-item';
        const avatar = document.createElement('span');
        avatar.className = 'member-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = user.username.charAt(0).toUpperCase();
        const name = document.createElement('span');
        name.className = 'member-name';
        name.textContent = user.username;
        item.append(avatar, name);
        if (user.id === socket.id) {
            const you = document.createElement('span');
            you.className = 'member-you';
            you.textContent = 'you';
            item.appendChild(you);
        }
        dom.membersList.appendChild(item);
    });
}

export function initRooms({ leaveVideoCall, stopTyping, clearTyping, clearMessages }) {
    const sidebarStorageKey = 'commonroom.roomSidebarCollapsed';
    const membersStorageKey = 'commonroom.membersSidebarVisible';

    function joinRoom(roomName) {
        const normalizedRoom = normalizeRoom(roomName);
        if (!normalizedRoom) return;
        leaveVideoCall();
        stopTyping();
        clearTyping();
        socket.emit('join room', normalizedRoom);
    }

    joinRoomAction = joinRoom;

    function onRoomJoined(roomName) {
        state.activeRoom = roomName;
        if (!state.roomNames.includes(roomName)) state.roomNames.push(roomName);
        localStorage.setItem(state.roomStorageKey, roomName);
        dom.roomTitle.textContent = roomName;
        dom.welcomeTitle.textContent = `Welcome to #${roomName}`;
        dom.welcomeRoomName.textContent = roomName.toUpperCase();
        renderRoomDetails(roomName);
        dom.messageInput.placeholder = `Message #${roomName}`;
        clearMessages();
        dom.conversation.classList.remove('has-messages');
        clearTyping();
        renderRooms();
        dom.conversation.scrollTop = dom.conversation.scrollHeight;
        dom.messageInput.focus();
    }

    function clearProfile() {
        dom.usernameInput.value = '';
        updateAvatar();
    }

    dom.usernameInput.value = localStorage.getItem(state.nameStorageKey) || '';
    updateAvatar();
    renderRooms();
    renderRoomDetails();

    dom.addRoomForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const roomName = normalizeRoom(dom.newRoomInput.value);
        if (!roomName) return;
        if (!state.roomNames.includes(roomName)) state.roomNames.push(roomName);
        renderRooms();
        joinRoom(roomName);
        dom.newRoomInput.value = '';
    });

    dom.saveNameButton.addEventListener('click', () => {
        const username = dom.usernameInput.value.trim().slice(0, 24);
        if (!username) {
            dom.usernameInput.focus();
            return;
        }
        dom.usernameInput.value = username;
        localStorage.setItem(state.nameStorageKey, username);
        updateAvatar();
        socket.emit('set username', username);
    });

    dom.usernameInput.addEventListener('input', updateAvatar);
    dom.usernameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') dom.saveNameButton.click();
    });

    dom.sidebarToggle.addEventListener('click', () => {
        const collapsed = !dom.appShell.classList.contains('sidebar-collapsed');
        dom.appShell.classList.toggle('sidebar-collapsed', collapsed);
        localStorage.setItem(sidebarStorageKey, String(collapsed));
        syncSidebarToggle();
    });

    dom.membersToggle.addEventListener('click', () => {
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        const visible = isMobile
            ? !dom.chatContent.classList.contains('members-open')
            : dom.chatContent.classList.contains('members-hidden');
        setMembersVisible(visible, isMobile);
        localStorage.setItem(membersStorageKey, String(visible));
    });

    dom.appShell.classList.toggle('sidebar-collapsed', localStorage.getItem(sidebarStorageKey) === 'true');
    syncSidebarToggle();
    window.addEventListener('resize', syncMembersPanel);
    syncMembersPanel();

    function syncSidebarToggle() {
        const expanded = !dom.appShell.classList.contains('sidebar-collapsed');
        dom.sidebarToggle.setAttribute('aria-expanded', String(expanded));
        dom.sidebarToggle.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} room sidebar`);
        dom.sidebarToggle.title = `${expanded ? 'Hide' : 'Show'} room sidebar`;
    }

    function setMembersVisible(visible, isMobile) {
        dom.chatContent.classList.toggle('members-open', isMobile && visible);
        dom.chatContent.classList.toggle('members-hidden', !isMobile && !visible);
        dom.membersToggle.setAttribute('aria-expanded', String(visible));
        dom.membersToggle.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} people sidebar`);
        dom.membersToggle.title = `${visible ? 'Hide' : 'Show'} people sidebar`;
    }

    function syncMembersPanel() {
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        const savedPreference = localStorage.getItem(membersStorageKey);
        const visible = savedPreference === null ? !isMobile : savedPreference === 'true';
        setMembersVisible(visible, isMobile);
    }

    return { clearProfile, joinRoom, onRoomJoined, updateAvatar };
}
