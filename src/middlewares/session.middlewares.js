import session from 'express-session';
import MongoStore from 'connect-mongo';

const sessionMiddleware = session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/chat',
    collectionName: 'sessions',
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 2, 
  },
});

export { sessionMiddleware};
