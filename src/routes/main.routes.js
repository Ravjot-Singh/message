import { Router } from 'express';
import { join } from 'path';
import bcrypt from 'bcrypt';
import { User } from '../models/user.models.js';

const router = Router();

router.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/index');
  res.sendFile(join(process.cwd(), 'public/login.html'));
});

router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/index');
  res.sendFile(join(process.cwd(), 'public/login.html'));
});

router.get('/register', (req, res) => {
  if (req.session?.user) return res.redirect('/index');
  res.sendFile(join(process.cwd(), 'public/register.html'));
});

router.get('/index', (req, res) => {
  if (!req.session?.user) return res.redirect('/login');
  res.sendFile(join(process.cwd(), 'public/index.html'));
});

router.get('/dm/:username', (req, res) => {
  if (!req.session?.user) return res.redirect('/login');
  res.sendFile(join(process.cwd(), 'public/dm.html'));
});

router.get('/users', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const users = await User.find({ username: { $ne: req.session.user.username } }).select('username');
  res.json(users);
});

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 7);
    const user = new User({ username, password: hash });
    await user.save();
    req.session.user = { _id: user._id, username: user.username };
    res.sendStatus(201);
  } catch (err) {
    res.status(400).send('Username already exists');
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).send('Invalid credentials');
  }
  req.session.user = { _id: user._id, username: user.username };
  res.send('Logged in successfully');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.send('Logged out'));
});

export default function setupRoutes(app) {
  app.use('/', router);
}
