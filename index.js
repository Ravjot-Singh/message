import 'dotenv/config';
import express from 'express';
import http from 'http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { Message } from './src/models/message.models.js';
import mongoose from 'mongoose';


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});

const PORT = process.env.PORT || 3000;

await mongoose.connect('mongodb://localhost:27017/chat');


const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/index.html'));
});



const connectedUsernames = new Set();

io.on('connection', async (socket) => {
    const username = socket.handshake.auth.username?.trim().toLowerCase();

    if (!username) {
        socket.disconnect();
        return;
    }

    if (connectedUsernames.has(username)) {
        socket.disconnect(new Error("Username is taken"));
        return;
    }

    connectedUsernames.add(username);
    socket.data.username = username;

    socket.on('disconnect', () => {
        connectedUsernames.delete(username);
    });

    socket.on('chat message', async (msg, clientOffset, callback) => {
        try {
            const result = await Message.create({
                content: msg,
                client_offset: clientOffset,
                senderUsername: username,
            });

            io.emit('chat message', msg, result._id.toString(), clientOffset, username);
            if (typeof callback === 'function') callback();
        } catch (e) {
            if (e.code === 11000 && typeof callback === 'function') {
                callback();
            } else {
                console.error("Message insertion failed!", e);
            }
        }
    });

    if (!socket.recovered) {
        try {
            const serverOffset = socket.handshake.auth.serverOffset || null;
            const query = serverOffset ? { _id: { $gt: serverOffset } } : {};
            const missedMessages = await Message.find(query).sort({ _id: 1 });

            for (const msg of missedMessages) {
                socket.emit('chat message', msg.content, msg._id.toString(), msg.client_offset, msg.senderUsername);
            }
        } catch (e) {
            console.error('Error recovering missed messages', e);
        }
    }
});





server.listen(PORT, () => {
    console.log(`Server listening at port ${PORT}`);
});

