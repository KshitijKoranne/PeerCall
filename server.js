// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a client joins a room
  socket.on('join-room', (roomName) => {
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room: ${roomName}`);
    
    // Inform existing room members of the new user
    socket.to(roomName).emit('user-joined', socket.id);

    // Relay signaling data (offers, answers, ICE candidates)
    socket.on('signal', (data) => {
      // data should have: { to: targetSocketId, signal: signalingData }
      io.to(data.to).emit('signal', {
        from: socket.id,
        signal: data.signal,
      });
    });

    // When the socket disconnects, notify others in the room
    socket.on('disconnect', () => {
      console.log(`Socket ${socket.id} disconnected`);
      socket.to(roomName).emit('user-left', socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
