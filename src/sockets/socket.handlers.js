import { Message } from '../models/message.models.js';
import { User } from '../models/user.models.js';

const userSockets = new Map();

export default function setupSocketHandlers(io) {
  io.on('connection', async (socket) => {
   

    const session = socket.handshake.session;

    if (!session?.user) {
      socket.disconnect(true);
      return;
    }

    const username = session.user.username;
    const userId = session.user._id;
    socket.data.username = username;

    userSockets.set(username, socket);

    socket.emit('session info', { username }); 

    async function recoverMessages(socket, lastMessageId) {
      try {
        const query = lastMessageId ? { _id: { $gt: lastMessageId } } : {};
        const missedMessages = await Message.find(query).sort({ createdAt: 1 });

        for (const msg of missedMessages) {
          // If the message is a FILE
          if (msg.isFile) {
            const payload = {
              _id: msg._id.toString(),
              from: msg.senderUsername,
              to: msg.recipientUsername,
              filename: msg.filename,
              type: msg.fileType,
              fileURL: `/uploads/${msg.recipientUsername ? 'private' : 'general'}/${msg.filename}`,
              clientOffset: msg.client_offset,
              isFile: true
            };

            if (msg.recipientUsername) {
              // PRIVATE file - send only to sender/recipient
              if ([msg.senderUsername, msg.recipientUsername].includes(socket.data.username)) {
                socket.emit('private file', payload);
              }
            } else {
              // GENERAL file - broadcast to everyone
              socket.emit('chat file', payload);
            }

            continue; // Skip to next message (don't process further)
          }

          // If the message is a TEXT (not a file)
          if (msg.recipientUsername) {
            // Private text message
            if ([msg.senderUsername, msg.recipientUsername].includes(socket.data.username)) {
              socket.emit('private message', {
                _id: msg._id.toString(),
                content: msg.content,
                from: msg.senderUsername,
                to: msg.recipientUsername,
                clientOffset: msg.client_offset,
              });
            }
          } else {
            // General text message
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


    socket.on('private file', async (data, callback) => {
      const { to, filename, type, fileURL, clientOffset } = data;
      const from = socket.data.username;

      const fileMessage = await Message.create({
        filename,
        fileType: type,
        client_offset: clientOffset,
        senderUsername: from,
        recipientUsername: to,
        isFile: true
      });

      await User.updateMany(
        { username: { $in: [from, to] } },
        { $push: { messages: fileMessage._id } }
      );

      const payload = {
        _id: fileMessage._id.toString(),
        from,
        to,
        filename,
        type,
        fileURL,
        clientOffset,
        isFile: true
      };

      socket.emit('private file', payload);
      const recipientSocket = userSockets.get(to);
      if (recipientSocket) {
        recipientSocket.emit('private file', payload);
      }

      callback?.();
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


    socket.on('chat file', async (data, callback) => {
      const { filename, type, fileURL, clientOffset } = data;
      const from = socket.data.username;

      const fileMessage = await Message.create({
        filename,
        fileType: type,
        client_offset: clientOffset,
        senderUsername: from,
        isFile: true
      });

      await User.updateOne({ username: from }, { $push: { messages: fileMessage._id } });

      io.emit('chat file', {
        _id: fileMessage._id.toString(),
        from,
        filename,
        type,
        fileURL,
        clientOffset,
        isFile: true
      });

      callback?.();
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



    socket.on('delete message', async (messageId, callback) => {

      try {
        const message = await Message.findById(messageId);

        if (!message || message.senderUsername !== socket.data.username) {
          return callback?.('Not authorized to delete it');
        }

        await message.deleteOne();

        io.emit('message deleted', messageId);

        callback?.({ success: true });

      } catch (error) {
        return callback?.('Unable to delete the message')
      }

    })



    if (!socket.recovered) {
      const serverOffset = socket.handshake.auth.serverOffset || null;
      await recoverMessages(socket, serverOffset);
    }
  });
}
