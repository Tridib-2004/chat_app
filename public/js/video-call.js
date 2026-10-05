import { dom, socket, state } from './state.js';

function createVideoTile(participantId, username, stream, isLocal = false) {
    let tile = state.videoTiles.get(participantId);
    if (!tile) {
        tile = document.createElement('article');
        tile.className = 'video-tile';
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = isLocal;
        const name = document.createElement('span');
        name.className = 'video-tile-name';
        tile.append(video, name);
        dom.videoGrid.appendChild(tile);
        state.videoTiles.set(participantId, tile);
    }

    tile.querySelector('video').srcObject = stream || null;
    tile.querySelector('.video-tile-name').textContent = isLocal ? `${username} (you)` : username;
}

function closePeerConnection(participantId) {
    const peerConnection = state.peerConnections.get(participantId);
    if (peerConnection) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.close();
        state.peerConnections.delete(participantId);
    }
    state.pendingIceCandidates.delete(participantId);
    state.videoTiles.get(participantId)?.remove();
    state.videoTiles.delete(participantId);
}

async function createPeerConnection(participant, shouldOffer) {
    let peerConnection = state.peerConnections.get(participant.id);
    if (peerConnection) return peerConnection;

    peerConnection = new RTCPeerConnection({ iceServers: state.iceServers });
    state.peerConnections.set(participant.id, peerConnection);
    createVideoTile(participant.id, participant.username, null);
    state.localMediaStream.getTracks().forEach((track) => peerConnection.addTrack(track, state.localMediaStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('video call signal', {
                to: participant.id,
                candidate: event.candidate.toJSON()
            });
        }
    };
    peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        createVideoTile(participant.id, participant.username, remoteStream);
    };
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed') {
            dom.videoCallStatus.textContent = 'Could not connect to a participant. A TURN server may be needed on this network.';
        }
    };

    if (shouldOffer) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('video call signal', {
            to: participant.id,
            description: {
                type: peerConnection.localDescription.type,
                sdp: peerConnection.localDescription.sdp
            }
        });
    }

    return peerConnection;
}

async function flushIceCandidates(participantId, peerConnection) {
    const candidates = state.pendingIceCandidates.get(participantId) || [];
    state.pendingIceCandidates.delete(participantId);
    for (const candidate of candidates) {
        await peerConnection.addIceCandidate(candidate);
    }
}

export function initVideoCall() {
    async function startVideoCall() {
        if (state.isStartingVideoCall || state.localMediaStream) return;
        if (!socket.connected) {
            dom.videoCallPanel.hidden = false;
            dom.workspaceBody.classList.add('call-active');
            dom.videoCallStatus.textContent = 'Wait for the chat to reconnect before starting a call.';
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            dom.videoCallPanel.hidden = false;
            dom.workspaceBody.classList.add('call-active');
            dom.videoCallStatus.textContent = 'Video calls require HTTPS or localhost and a supported browser.';
            return;
        }

        state.isStartingVideoCall = true;
        dom.videoCallButton.disabled = true;
        dom.videoCallStatus.textContent = 'Requesting camera and microphone...';
        dom.videoCallPanel.hidden = false;
        dom.workspaceBody.classList.add('call-active');
        try {
            state.localMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            dom.videoCallTitle.textContent = `#${state.activeRoom} video call`;
            dom.videoCallStatus.textContent = 'Joining call...';
            dom.videoCallButton.textContent = 'In call';
            createVideoTile(socket.id, dom.usernameInput.value.trim() || 'Anonymous', state.localMediaStream, true);
            socket.emit('video call join');
        } catch (error) {
            dom.videoCallStatus.textContent = error.name === 'NotAllowedError'
                ? 'Allow camera and microphone access to join the call.'
                : 'Could not start the camera and microphone.';
            state.localMediaStream = null;
            dom.videoCallPanel.hidden = false;
        } finally {
            state.isStartingVideoCall = false;
            dom.videoCallButton.disabled = false;
        }
    }

    function leaveVideoCall(notifyServer = true) {
        if (notifyServer && socket.connected && state.localMediaStream) {
            socket.emit('video call leave');
        }
        state.peerConnections.forEach((peerConnection) => peerConnection.close());
        state.peerConnections.clear();
        state.pendingIceCandidates.clear();
        state.videoTiles.clear();
        dom.videoGrid.replaceChildren();
        state.localMediaStream?.getTracks().forEach((track) => track.stop());
        state.localMediaStream = null;
        dom.videoCallPanel.hidden = true;
        dom.workspaceBody.classList.remove('call-active');
        dom.videoCallButton.textContent = 'Start call';
        dom.videoCallButton.disabled = state.isStartingVideoCall;
        dom.microphoneButton.textContent = 'Mute mic';
        dom.microphoneButton.setAttribute('aria-pressed', 'true');
        dom.cameraButton.textContent = 'Turn camera off';
        dom.cameraButton.setAttribute('aria-pressed', 'true');
    }

    dom.videoCallButton.addEventListener('click', startVideoCall);
    dom.leaveCallButton.addEventListener('click', () => leaveVideoCall());
    dom.microphoneButton.addEventListener('click', () => {
        const tracks = state.localMediaStream?.getAudioTracks() || [];
        if (!tracks.length) return;
        const enabled = !tracks[0].enabled;
        tracks.forEach((track) => { track.enabled = enabled; });
        dom.microphoneButton.textContent = enabled ? 'Mute mic' : 'Unmute mic';
        dom.microphoneButton.setAttribute('aria-pressed', String(enabled));
    });
    dom.cameraButton.addEventListener('click', () => {
        const tracks = state.localMediaStream?.getVideoTracks() || [];
        if (!tracks.length) return;
        const enabled = !tracks[0].enabled;
        tracks.forEach((track) => { track.enabled = enabled; });
        dom.cameraButton.textContent = enabled ? 'Turn camera off' : 'Turn camera on';
        dom.cameraButton.setAttribute('aria-pressed', String(enabled));
    });

    socket.on('video call joined', ({ roomName }) => {
        dom.videoCallTitle.textContent = `#${roomName} video call`;
        dom.videoCallStatus.textContent = 'Waiting for video...';
    });
    socket.on('video call participants', async (participants) => {
        for (const participant of participants) await createPeerConnection(participant, false);
    });
    socket.on('video call participant joined', async ({ participant }) => {
        await createPeerConnection(participant, true);
    });
    socket.on('video call participants changed', (participants) => {
        dom.videoCallStatus.textContent = `${participants.length} ${participants.length === 1 ? 'person' : 'people'} in the call`;
    });
    socket.on('video call participant left', ({ id }) => closePeerConnection(id));
    socket.on('video call signal', async (signal) => {
        try {
            const participant = { id: signal.from, username: signal.username };
            const peerConnection = await createPeerConnection(participant, false);
            if (signal.description) {
                await peerConnection.setRemoteDescription(signal.description);
                await flushIceCandidates(signal.from, peerConnection);
                if (signal.description.type === 'offer') {
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('video call signal', {
                        to: signal.from,
                        description: {
                            type: peerConnection.localDescription.type,
                            sdp: peerConnection.localDescription.sdp
                        }
                    });
                }
            }
            if (signal.candidate) {
                const candidate = new RTCIceCandidate(signal.candidate);
                if (peerConnection.remoteDescription) await peerConnection.addIceCandidate(candidate);
                else {
                    const candidates = state.pendingIceCandidates.get(signal.from) || [];
                    candidates.push(candidate);
                    state.pendingIceCandidates.set(signal.from, candidates);
                }
            }
        } catch {
            dom.videoCallStatus.textContent = 'A video connection could not be established.';
        }
    });
    socket.on('video call error', (message) => {
        leaveVideoCall(false);
        dom.videoCallPanel.hidden = false;
        dom.videoCallStatus.textContent = message;
    });

    return { leaveVideoCall };
}
