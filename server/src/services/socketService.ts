import { Server, Socket } from 'socket.io';
import http from 'http';
import Message from '../models/Message';
import User from '../models/User';

export const initSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  // Track online socket connections mapped to user IDs
  const activeConnections = new Map<string, string>(); // socketId -> userId

  io.on('connection', (socket: Socket) => {
    console.log(`Socket Connected: ${socket.id}`);

    // User joins personal room to receive direct events
    socket.on('join-room', async (userId: string) => {
      socket.join(userId);
      activeConnections.set(socket.id, userId);
      console.log(`User ${userId} joined room ${userId}`);
      
      // Update online status in DB and broadcast to others
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('user-status-changed', { userId, isOnline: true });
      } catch (err) {
        console.error('Error setting user online:', err);
      }
    });

    // Send and store real-time chat messages
    socket.on('send-message', async (data: { senderId: string; receiverId: string; content: string }) => {
      try {
        const { senderId, receiverId, content } = data;
        
        // Save message to DB
        const newMessage = new Message({
          senderId,
          receiverId,
          content,
          isRead: false
        });
        await newMessage.save();

        // Emit to receiver and sender (for multi-device sync or confirmations)
        const serialized = newMessage.toJSON();
        io.to(receiverId).emit('receive-message', serialized);
        io.to(senderId).emit('message-sent', serialized);
      } catch (err) {
        console.error('Error saving/sending socket message:', err);
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // WebRTC Signaling Event: Call Request
    socket.on('call-user', (data: { offer: any; to: string; from: string; name: string }) => {
      console.log(`Signaling: Call User from ${data.from} to ${data.to}`);
      io.to(data.to).emit('incoming-call', {
        offer: data.offer,
        from: data.from,
        name: data.name
      });
    });

    // WebRTC Signaling Event: Call Response
    socket.on('answer-call', (data: { answer: any; to: string }) => {
      console.log(`Signaling: Answer Call to ${data.to}`);
      io.to(data.to).emit('call-accepted', {
        answer: data.answer
      });
    });

    // WebRTC Signaling Event: Candidate exchange
    socket.on('ice-candidate', (data: { candidate: any; to: string }) => {
      console.log(`Signaling: Ice Candidate to ${data.to}`);
      io.to(data.to).emit('ice-candidate', {
        candidate: data.candidate
      });
    });

    // WebRTC Signaling Event: Terminate call
    socket.on('end-call', (data: { to: string }) => {
      console.log(`Signaling: Call Ended by socket to ${data.to}`);
      io.to(data.to).emit('call-ended');
    });

    // Handle Socket Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket Disconnected: ${socket.id}`);
      const userId = activeConnections.get(socket.id);
      if (userId) {
        activeConnections.delete(socket.id);
        
        // Check if user has other tabs open before marking offline
        const matchingSockets = await io.in(userId).fetchSockets();
        if (matchingSockets.length === 0) {
          try {
            await User.findByIdAndUpdate(userId, { isOnline: false });
            io.emit('user-status-changed', { userId, isOnline: false });
            console.log(`User ${userId} marked offline`);
          } catch (err) {
            console.error('Error setting user offline:', err);
          }
        }
      }
    });
  });

  return io;
};
