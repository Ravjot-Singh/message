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
const io = new Server(server , {
    connectionStateRecovery : {}
});

const PORT = process.env.PORT || 3000;

await mongoose.connect('mongodb://localhost:27017/chat');


const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/index.html'));
});



io.on('connection', async(socket) => {

  socket.on('chat message', async (msg , clientOffset , callback) => {

    let result;
    try {
   
      result = await Message.create({
        content : msg,
        client_offset : clientOffset
      })

      
    } catch (e) {
      if(e.code ===11000){
        callback();
      }
      else{
        console.log("Message insertion failed! " , e);
      }
      return;
    }

    io.emit('chat message', msg, result._id.toString() , clientOffset);

    callback();
  });


  if (!socket.recovered) {
  try {
    const serverOffset = socket.handshake.auth.serverOffset || null;

    const query = serverOffset
      ? { _id: { $gt: serverOffset } }
      : {};

    const missedMessages = await Message.find(query).sort({ _id: 1 });

    for (const msg of missedMessages) {
      socket.emit('chat message', msg.content, msg._id.toString());
    }

  } catch (e) {
    console.error('Error recovering missed messages', e);
  }
}

});







server.listen(PORT, () => {
    console.log(`Server listening at port ${PORT}`);
});

