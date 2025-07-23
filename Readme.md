# Real-Time Chat Application

A full-stack real-time chat application built with **Node.js**, **Express**, **MongoDB**, **Socket.IO**, and **Vanilla JS**.  
Supports public chat, direct messaging (DM), file sharing, message editing/deletion, authentication, and session management.

---

## Features

- **User Authentication**: Register, login, and logout with secure sessions.
- **Public Chat**: Join a general chat room with all users.
- **Direct Messaging (DM)**: Private one-on-one conversations.
- **File Sharing**: Send images, videos, and files in both public and private chats.
- **Edit/Delete Messages**: Users can edit or delete their own messages.
- **Session Persistence**: Sessions stored in MongoDB for reliability.
- **Rate Limiting**: Prevents abuse via API and socket rate limiting.
- **Responsive UI**: Clean, modern interface with mobile support.

---

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Mongoose, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Authentication**: express-session, connect-mongo, bcrypt
- **File Uploads**: multer
- **Rate Limiting**: express-rate-limit (HTTP), custom for sockets

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) (local or Atlas)

### Installation

1. **Clone the repository:**
    ```sh
    git clone https://github.com/Ravjot-Singh/message.git
    cd message
    ```

2. **Install dependencies:**
    ```sh
    npm install
    ```

3. **Start MongoDB** (if running locally):
    ```sh
    mongod
    ```

4. **Run the server:**
    ```sh
    npm start
    ```
    The server will run on [http://localhost:3000](http://localhost:3000) by default.

---

## Project Structure

```
├── index.js                # Main server entry point
├── public/                 # Static frontend files (HTML, CSS, JS)
│   ├── index.html
│   ├── dm.html
│   └── styles.css
├── src/
│   ├── models/             # Mongoose models (User, Message)
│   ├── middlewares/        # Session, rate limiters
│   ├── routes/             # Express routes (main, upload)
│   ├── sockets/            # Socket.IO handlers
│   └── uploads/            # Uploaded files (private/general)
└── package.json
```

---

## Usage

- **Register** a new account or **login** with existing credentials.
- **Chat** in the public room or click a user to start a DM.
- **Send files** by attaching them in the chat form.
- **Edit/Delete** your own messages by clicking the ✏️ or 🗑️ buttons.
- **Logout** using the logout button.

---

## Environment Variables

You can use a `.env` file to override defaults:

```
PORT=3000
MONGO_URL=mongodb://localhost:27017/chat
SESSION_SECRET=your-secret
```

---

## Security Notes

- Passwords are hashed with bcrypt.
- Sessions are stored securely in MongoDB.
- Rate limiting is applied to both HTTP and socket connections.

---

## Credits

- [Socket.IO](https://socket.io/)
- [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)