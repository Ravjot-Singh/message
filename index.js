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
    if (req.session?.user) {
        return res.redirect('/index');
    }
    return res.sendFile(join(__dirname, 'public/login.html'));
});

// Explicit login route (optional, same as '/')
app.get('/login', (req, res) => {
    if (req.session?.user) {
        return res.redirect('/index');
    }
    res.sendFile(join(__dirname, 'public/login.html'));
});

// Registration page
app.get('/register', (req, res) => {
    if (req.session?.user) {
        return res.redirect('/index');
    }
    res.sendFile(join(__dirname, 'public/register.html'));
});

// Main chat page
app.get('/index', (req, res) => {
    if (!req.session?.user) {
        return res.redirect('/login');
    }
    res.sendFile(join(__dirname, 'public/index.html'));
});

// DM page
app.get('/dm/:username', (req, res) => {
    if (!req.session?.user) {
        return res.redirect('/login');
    }
    res.sendFile(join(__dirname, 'public/dm.html'));
});

// Get users list (except current user)
app.get('/users', async (req, res) => {
    if (!req.session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const users = await User.find({
        username: { $ne: req.session.user.username }
    }).select('username');

    res.json(users);
});




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



const userSockets = new Map();


io.on('connection', async (socket) => {
    const session = socket.request.session;
    if (!session?.user) {
        socket.disconnect(true);
        return;
    }


    async function recoverMessages(socket, lastMessageId) {
        try {
            const username = socket.data.username;

            const query = lastMessageId
                ? { _id: { $gt: lastMessageId } }
                : {};

            const missedMessages = await Message.find(query).sort({ createdAt: 1 });

            for (const msg of missedMessages) {
                // DM case: Only send to involved parties
                if (msg.recipientUsername) {
                    if ([msg.senderUsername, msg.recipientUsername].includes(username)) {
                        socket.emit('private message', {
                            _id: msg._id.toString(),
                            content: msg.content,
                            from: msg.senderUsername,
                            to: msg.recipientUsername,
                            clientOffset: msg.client_offset,
                        });
                    }
                } else {
                    // Public message
                    socket.emit('chat message', msg.content, msg._id.toString(), msg.client_offset, msg.senderUsername);
                }
            }
        } catch (err) {
            console.error('Error recovering messages:', err);
        }
    }




    const userId = session.user._id;
    const username = session.user.username;
    socket.data.username = username;
    userSockets.set(username, socket);





    socket.on('private message', async (msg, toUsername, clientOffset, callback) => {
        try {


            const recipientSocket = userSockets.get(toUsername);

            const messageDoc = await Message.create({
                content: msg,
                client_offset: clientOffset,
                senderUsername: username,
                recipientUsername: toUsername
            })

            await User.updateMany(
                { username: { $in: [username, toUsername] } },
                { $push: { messages: messageDoc._id } }
            )

            const messagePayLoad = {
                _id: messageDoc._id.toString(),
                content: msg,
                from: username,
                to: toUsername,
                clientOffset
            };

            socket.emit('private message', messagePayLoad);

            if (recipientSocket) {
                recipientSocket.emit('private message', messagePayLoad);
            }

            callback?.();

        } catch (error) {
            if (error.code === 11000) {
                callback?.();
            } else {
                console.log('DM save error : ', error);
            }
        }

    });


    socket.on('chat message', async (msg, clientOffset, callback) => {
        try {
            const message = await Message.create({
                content: msg,
                client_offset: clientOffset,
                senderUsername: username
            });

            await User.findByIdAndUpdate(userId, {
                $push: { messages: message._id }
            });

            io.emit('chat message', msg, message._id.toString(), clientOffset, username);
            if (typeof callback === 'function') callback();
        } catch (err) {
            if (err.code === 11000 && typeof callback === 'function') {
                callback();
            } else {
                console.error("Message save error:", err);
            }
        }
    });

    if (!socket.recovered) {

        const serverOffset = socket.handshake.auth.serverOffset || null;
        await recoverMessages(socket, serverOffset);

    }
});





server.listen(PORT, () => {
    console.log(`Server listening at port ${PORT}`);
});

