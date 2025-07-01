import { Message } from '../models/message.models.js';
import { User } from '../models/user.models.js';

const userSockets = new Map();

export default function setupSocketHandlers(io) {
  io.on('connection', async (socket) => {
    const session = socket.request.session;
    if (!session?.user) {
      socket.disconnect(true);
      return;
    }

    const username = session.user.username;
    const userId = session.user._id;
    socket.data.username = username;
    userSockets.set(username, socket);

    async function recoverMessages(socket, lastMessageId) {
      try {
        const query = lastMessageId ? { _id: { $gt: lastMessageId } } : {};
        const missedMessages = await Message.find(query).sort({ createdAt: 1 });

        for (const msg of missedMessages) {
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
            socket.emit('chat message', msg.content, msg._id.toString(), msg.client_offset, msg.senderUsername);
          }
        }
      } catch (err) {
        console.error('Error recovering messages:', err);
      }
    }


    // for DMs

    socket.on('private message', async (msg, toUsername, clientOffset, callback) => {
      try {
        const recipientSocket = userSockets.get(toUsername);

        const messageDoc = await Message.create({
          content: msg,
          client_offset: clientOffset,
          senderUsername: username,
          recipientUsername: toUsername,
        });

        await User.updateMany(
          { username: { $in: [username, toUsername] } },
          { $push: { messages: messageDoc._id } }
        );

        const payload = {
          _id: messageDoc._id.toString(),
          content: msg,
          from: username,
          to: toUsername,
          clientOffset,
        };

        socket.emit('private message', payload);
        if (recipientSocket) recipientSocket.emit('private message', payload);
        callback?.();
      } catch (err) {
        if (err.code === 11000) callback?.();
        else console.error('DM error:', err);
      }
    });



    // for general Chat Box

    socket.on('chat message', async (msg, clientOffset, callback) => {
      try {
        const message = await Message.create({
          content: msg,
          client_offset: clientOffset,
          senderUsername: username,
        });

        await User.findByIdAndUpdate(userId, { $push: { messages: message._id } });

        io.emit('chat message', msg, message._id.toString(), clientOffset, username);
        callback?.();
      } catch (err) {
        if (err.code === 11000) callback?.();
        else console.error('Chat save error:', err);
      }
    });



    socket.on('edit message', async ({ messageId, newContent }, callback) => {
      try {

        const message = await Message.findById(messageId);

        if (!message || message.senderUsername !== socket.data.username) {
          return callback?.({ error: 'Unauthorized to edit' });
        }

        message.content = newContent;
        message.edited = true;

       await message.save();

        io.emit('message edited', {
          messageId,
          newContent,
          edited: true
        });

        callback?.({ success: true });

      } catch (error) {
        callback?.({ error: 'Edit failed' });
      }
    });



    socket.on('delete message' , async(messageId , callback)=>{

      try{
        const message = await Message.findById(messageId);

        if(!message || message.senderUsername !== socket.data.username){
          return callback?.('Not authorized to delete it');
        }

        await message.deleteOne();

        io.emit('message deleted' , messageId);

        callback?.({success : true});

      }catch(error){
        return callback?.('Unable to delete the message')
      }

    })



    if (!socket.recovered) {
      const serverOffset = socket.handshake.auth.serverOffset || null;
      await recoverMessages(socket, serverOffset);
    }
  });
}
