import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import dns from 'dns';
import connectDB from './config/db';

dns.setDefaultResultOrder('ipv4first');
import authRoutes from './routes/authRoutes';
import meetingRoutes from './routes/meetingRoutes';
import documentRoutes from './routes/documentRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { initSocket } from './services/socketService';

// Load config
dotenv.config();

// Connect DB
connectDB();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Higher limit for base64 e-signatures
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Nexus API is running smoothly' });
});

// Initialize Socket.IO and WebRTC signaling
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`======================================`);
  console.log(`Nexus Backend Server running on Port ${PORT}`);
  console.log(`======================================`);
});
