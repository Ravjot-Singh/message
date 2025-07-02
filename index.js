import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { sessionMiddleware } from './src/middlewares/session.middlewares.js';
import setupRoutes from './src/routes/main.routes.js';
import setupSocketHandlers from './src/sockets/socket.handlers.js';
import path from 'path';
import uploadRoutes from './src/routes/upload.routes.js'

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: false,
    },
});

const PORT = process.env.PORT || 3000;
await mongoose.connect('mongodb://localhost:27017/chat');

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Routes
setupRoutes(app);

app.use('/uploads', express.static(path.join(__dirname, 'src', 'uploads')));

app.use('/upload', uploadRoutes );

// Sockets
setupSocketHandlers(io);



server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
