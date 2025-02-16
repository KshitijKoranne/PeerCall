// public/js/main.js

const socket = io();

const videosDiv = document.getElementById('videos');
const localVideo = document.getElementById('localVideo');
const notificationsDiv = document.getElementById('notifications');
const callControls = document.getElementById('callControls');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const globalConnectionStatus = document.getElementById('globalConnectionStatus');
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

// ---------- Device List Population ----------
async function populateDeviceLists() {
  try {
    // To get real device labels, request a temporary stream if not already obtained.
    if (!localStream) {
      // Request with minimal constraints; then immediately stop tracks.
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach(track => track.stop());
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');

    cameraSelect.innerHTML = "";
    micSelect.innerHTML = "";

    videoDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${cameraSelect.length + 1}`;
      cameraSelect.appendChild(option);
    });

    audioDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Mic ${micSelect.length + 1}`;
      micSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Error enumerating devices:", err);
  }
}

// getLocalStream: Request media; then immediately disable all tracks so that video/mic are off by default.
// Request permissions & set up local video
async function getLocalStream() {
  try {
      localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }, // Ensures front camera use on mobile
          audio: true
      });

      // Assign the stream after a delay to ensure Safari attaches it
      setTimeout(() => {
          localVideo.srcObject = localStream;
          localVideo.muted = true;  // Autoplay fix
          localVideo.setAttribute("playsinline", ""); // iOS Safari fix

          // ✅ Force Safari to recognize video stream
          localVideo.play().catch(error => console.error("Safari Autoplay Blocked:", error));

      }, 500); // Small delay for Safari compatibility

      // Disable video/mic initially
      localStream.getTracks().forEach(track => track.enabled = false);
      videoEnabled = false;
      micEnabled = false;
      toggleVideoBtn.textContent = "Turn Video On";
      toggleMicBtn.textContent = "Turn Mic On";
      
      console.log("Local stream initialized.");
  } catch (err) {
      console.error("Error accessing media devices.", err);
      alert("Could not access your camera and microphone. Please check browser permissions.");
  }
}

// Toggle Video Button
toggleVideoBtn.addEventListener('click', function() {
  if (!localStream) return;
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks().forEach(track => {
    track.enabled = videoEnabled;
  });
  toggleVideoBtn.textContent = videoEnabled ? "Turn Video Off" : "Turn Video On";
});

// Toggle Mic Button
toggleMicBtn.addEventListener('click', function() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  toggleMicBtn.textContent = micEnabled ? "Turn Mic Off" : "Turn Mic On";
});

// ---------- WebRTC & Signaling ----------
async function getLocalStreamForCall() {
  // This function can be reused later if we need to restart local stream.
  await getLocalStream();
}

function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  // Add tracks if available.
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }
  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('signal', {
        to: peerId,
        signal: { candidate: event.candidate }
      });
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

      const statusSpan = document.createElement('span');
      statusSpan.id = `status-${peerId}`;
      statusSpan.className = 'connection-status';
      statusSpan.innerText = "Connecting...";
      container.appendChild(statusSpan);

      videosDiv.appendChild(container);
    }
    const remoteVideo = container.querySelector('video');
    remoteVideo.srcObject = event.streams[0];
  };
  return pc;
}

// ---------- Socket.io Event Handlers ----------
socket.on('user-joined', async (peerId) => {
  addNotification("User joined: " + peerId, "info");
  const pc = createPeerConnection(peerId);
  peers[peerId] = pc;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', {
    to: peerId,
    signal: { sdp: pc.localDescription }
  });
});

socket.on('signal', async (data) => {
  const { from, signal } = data;
  let pc = peers[from];
  if (!pc) {
    pc = createPeerConnection(from);
    peers[from] = pc;
  }
  if (signal.sdp) {
    const description = new RTCSessionDescription(signal.sdp);
    await pc.setRemoteDescription(description);
    if (description.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', {
        to: from,
        signal: { sdp: pc.localDescription }
      });
    }
  }
  if (signal.candidate) {
    try {
      await pc.addIceCandidate(signal.candidate);
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }
});

socket.on('user-left', (peerId) => {
  addNotification("User left: " + peerId, "warning");
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
  }
  const container = document.getElementById(`container-${peerId}`);
  if (container) {
    container.remove();
  }
});

// ---------- End Call Functionality ----------
function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  for (const peerId in peers) {
    peers[peerId].close();
    delete peers[peerId];
  }
  const remoteContainers = document.querySelectorAll('.video-container');
  remoteContainers.forEach(container => {
    if (container.id !== "localContainer") {
      container.remove();
    }
  });
  addNotification("Call ended", "warning");
  callControls.style.display = "none";
}

endCallBtn.addEventListener('click', endCall);

// ---------- Initialization ----------
// Request device permissions and populate device lists.
// This call sets up localStream and then immediately disables tracks (keeping them off by default).
(async function initCall() {
  await populateDeviceLists();
  await getLocalStream();
  // Ensure tracks are off by default:
  if (localStream) {
    localStream.getTracks().forEach(track => { track.enabled = false; });
  }
  videoEnabled = false;
  micEnabled = false;
  toggleVideoBtn.textContent = "Turn Video On";
  toggleMicBtn.textContent = "Turn Mic On";
  callControls.style.display = "flex";
})();