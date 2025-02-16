const socket = io();

const videosDiv = document.getElementById('videos');
const localVideo = document.getElementById('localVideo');
const notificationsDiv = document.getElementById('notifications');
const endCallBtn = document.getElementById('endCallBtn');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');

let localStream;
const peers = {}; // Maps peerId -> RTCPeerConnection

// Global state for toggles
let videoEnabled = false;
let micEnabled = false;

// ---------- Notification Functionality ----------
function addNotification(message, type = "info") {
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.role = "alert";
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  notificationsDiv.appendChild(alert);
  setTimeout(() => {
    alert.classList.remove("show");
    setTimeout(() => { alert.remove(); }, 500);
  }, 5000);
}

// ---------- Get Local Stream (Default to Front Camera) ----------
async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" }, // Use front camera
            audio: true
        });

        localVideo.srcObject = localStream;
        localVideo.muted = true;
        localVideo.setAttribute("playsinline", ""); // iOS Safari fix

        // Ensure Safari attaches stream properly
        setTimeout(() => {
            if (localVideo.paused) {
                localVideo.play().catch(error => console.error("Safari Autoplay Blocked:", error));
            }
        }, 500);

        // Disable video/mic initially
        localStream.getTracks().forEach(track => track.enabled = false);
        videoEnabled = false;
        micEnabled = false;
    } catch (err) {
        console.error("Error accessing media devices.", err);
        alert("Could not access your camera and microphone. Please check browser permissions.");
    }
}

// ---------- Toggle Video Functionality ----------
toggleVideoBtn.addEventListener("click", function () {
    if (!localStream) return;
    
    videoEnabled = !videoEnabled;
    localStream.getVideoTracks().forEach(track => track.enabled = videoEnabled);

    // Change icon based on state
    const videoIcon = document.getElementById("videoIcon");
    videoIcon.innerHTML = videoEnabled
        ? `<path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5zm15.5-1.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5 1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5z"/>`
        : `<path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5zm10.854 3.646a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1-.708.708l-2-2z"/>`; // Video off icon
});

// ---------- Toggle Mic Functionality ----------
toggleMicBtn.addEventListener("click", function () {
    if (!localStream) return;

    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);

    // Change icon based on state
    const micIcon = document.getElementById("micIcon");
    micIcon.innerHTML = micEnabled
        ? `<path fill-rule="evenodd" d="M8 1a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path fill-rule="evenodd" d="M5 10.5a4 4 0 1 0 6 0V4a4 4 0 1 0-6 0v6.5z"/>`
        : `<path fill-rule="evenodd" d="M8 1a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path fill-rule="evenodd" d="M3.05 3.05a.5.5 0 0 1 .707-.707l9.192 9.192a.5.5 0 1 1-.707.707L3.05 3.05z"/>`; // Mic off icon
});

// ---------- WebRTC & Signaling ----------
function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('signal', { to: peerId, signal: { candidate: event.candidate } });
        }
    };

    pc.ontrack = event => {
        let container = document.getElementById(`container-${peerId}`);
        if (!container) {
            container = document.createElement('div');
            container.className = 'video-container';
            container.id = `container-${peerId}`;

            const remoteVideo = document.createElement('video');
            remoteVideo.id = peerId;
            remoteVideo.autoplay = true;
            remoteVideo.classList.add('video-box');
            container.appendChild(remoteVideo);

            videosDiv.appendChild(container);
        }
        container.querySelector('video').srcObject = event.streams[0];
    };

    return pc;
}

// ---------- End Call Functionality ----------
function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    for (const peerId in peers) {
        peers[peerId].close();
        delete peers[peerId];
    }

    document.querySelectorAll('.video-container').forEach(container => {
        if (container.id !== "localContainer") {
            container.remove();
        }
    });

    addNotification("Call ended", "warning");
}

endCallBtn.addEventListener('click', endCall);

// ---------- Initialization ----------
(async function initCall() {
    await getLocalStream();
    if (localStream) {
        localStream.getTracks().forEach(track => track.enabled = false);
    }
    videoEnabled = false;
    micEnabled = false;
})();