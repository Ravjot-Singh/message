import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { sessionMiddleware } from './src/middlewares/session.middlewares.js';
import bcrypt from 'bcrypt';
import { User } from './src/models/user.models.js';
import { Message } from './src/models/message.models.js';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cookieParser from 'cookie-parser';


const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: false
    }
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
})


app.get('/', (req, res) => {
     if (!req.session?.user) {
    return res.redirect('/login');
  }
});

app.get('/index', (req, res) => {
  if (!req.session?.user) return res.redirect('/login');
  res.sendFile(join(__dirname, 'public/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'public/login.html'));
});

app.get('/register', (req, res) =>
  res.sendFile(join(__dirname, 'public/register.html'))
);


app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hash = await bcrypt.hash(password, 7);
        const user = new User({
            username,
            password: hash
        });

        await user.save();
        req.session.user = {
            _id: user._id,
            username: user.username
        };

        res.sendStatus(201);

    } catch (error) {
        res.status(400).send('Username already exists');
    }

});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send("Invalid credentials");
    }

    req.session.user = { _id: user._id, username: user.username };
    res.send('Logged in successfully')

})

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.send('Logged out'));
});





io.on('connection', async (socket) => {
    const session = socket.request.session;
    if (!session?.user) {
        socket.disconnect(true);
        return;
    }

    const userId = session.user._id;
    const username = session.user.username;
    socket.data.username = username;


    socket.on('chat message', async (msg, clientOffset, callback) => {
        try {
            const message = await Message.create({
                content: msg,
                client_offset: clientOffset,
                senderUsername : username
            });

            await User.findByIdAndUpdate(userId, {
                $push: { messages: message._id }
            });

            io.emit('chat message', msg, message._id.toString(), clientOffset, username);
            if (typeof callback === 'function') callback();
        } catch (err) {
            if (err.code === 11000 && typeof callback === 'function') {
                callback(); // duplicate offset
            } else {
                console.error("Message save error:", err);
            }
        }
    });

    if (!socket.recovered) {
        try {
            const serverOffset = socket.handshake.auth.serverOffset || null;

            const query = serverOffset ? { _id: { $gt: serverOffset } } : {};

            const missedMessages = await Message.find(query).sort({ createdAt: 1 });

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

