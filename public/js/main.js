import { initAuth } from './auth.js';
import { initMessages, stopTyping, clearTyping } from './messages.js';
import { initRooms } from './rooms.js';
import { initUploads } from './uploads.js';
import { initVideoCall } from './video-call.js';
import { initSocketEvents } from './socketEvents.js';

initMessages();
const videoCall = initVideoCall();
const rooms = initRooms({
    leaveVideoCall: videoCall.leaveVideoCall,
    stopTyping,
    clearTyping,
    clearMessages: () => document.getElementById('messages').replaceChildren()
});
initUploads();
const auth = initAuth({
    onExit: () => videoCall.leaveVideoCall(false),
    onProfileReset: rooms.clearProfile
});

initSocketEvents({
    onRoomJoined: rooms.onRoomJoined,
    onVideoCallDisconnect: () => videoCall.leaveVideoCall(false)
});

auth.restoreSession();
