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
// Toggle Video Functionality
toggleVideoBtn.addEventListener("click", function () {
  if (!localStream) return;
  
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks().forEach(track => track.enabled = videoEnabled);

  // Change icon based on state
  document.getElementById("videoIcon").innerHTML = videoEnabled
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="26" height="26"><path d="M0 128C0 92.7 28.7 64 64 64l256 0c35.3 0 64 28.7 64 64l0 256c0 35.3-28.7 64-64 64L64 448c-35.3 0-64-28.7-64-64L0 128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2l0 256c0 11.8-6.5 22.6-16.9 28.2s-23 5-32.9-1.6l-96-64L416 337.1l0-17.1 0-128 0-17.1 14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="26" height="26"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7l-86.4-67.7 13.8 9.2c9.8 6.5 22.4 7.2 32.9 1.6s16.9-16.4 16.9-28.2l0-256c0-11.8-6.5-22.6-16.9-28.2s-23-5-32.9 1.6l-96 64L448 174.9l0 17.1 0 128 0 5.8-32-25.1L416 128c0-35.3-28.7-64-64-64L113.9 64 38.8 5.1z"/></svg>`;
});

// ---------- Toggle Mic Functionality ----------
// Toggle Mic Functionality
toggleMicBtn.addEventListener("click", function () {
  if (!localStream) return;

  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);

  // Change icon based on state
  document.getElementById("micIcon").innerHTML = micEnabled
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="24" height="24"><path d="M96 96l0 160c0 53 43 96 96 96s96-43 96-96l-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0 0-32-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0 0-32-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0c0-53-43-96-96-96S96 43 96 96zM320 240l0 16c0 70.7-57.3 128-128 128s-128-57.3-128-128l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 40c0 89.1 66.2 162.7 152 174.4l0 33.6-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l72 0 72 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-33.6c85.8-11.7 152-85.3 152-174.4l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 24z"/></svg>` // Mic On Icon
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="24" height="24"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L472.1 344.7c15.2-26 23.9-56.3 23.9-88.7l0-40c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 24 0 16c0 21.2-5.1 41.1-14.2 58.7L416 300.8l0-44.8-57.1 0-34.5-27c2.9-3.1 7-5 11.6-5l80 0 0-32-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0 0-32-80 0c-8.8 0-16-7.2-16-16s7.2-16 16-16l80 0c0-53-43-96-96-96s-96 43-96 96l0 54.3L38.8 5.1zm362.5 407l-43.1-33.9C346.1 382 333.3 384 320 384c-70.7 0-128-57.3-128-128l0-8.7L144.7 210c-.5 1.9-.7 3.9-.7 6l0 40c0 89.1 66.2 162.7 152 174.4l0 33.6-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l72 0 72 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-33.6c20.4-2.8 39.7-9.1 57.3-18.2z"/></svg>`; // Mic Off Icon
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