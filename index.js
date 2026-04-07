const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store last 30 rolls in memory
const rolls = [];
const MAX_ROLLS = 30;

// API: receive a new roll from the extension
app.post('/api/roll', (req, res) => {
  const { pfRoll, userId, username, avatar, type, multiplier, itemFrom, itemTo } = req.body;

  if (!type || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    pfRoll: pfRoll != null ? Number(pfRoll) : null,
    userId: String(userId || ''),
    username: String(username || 'Anônimo'),
    avatar: String(avatar || ''),
    type: String(type),
    multiplier: String(multiplier || ''),
    itemFrom: itemFrom || null,
    itemTo: itemTo || null,
    timestamp: Date.now()
  };

  rolls.unshift(entry);
  if (rolls.length > MAX_ROLLS) rolls.length = MAX_ROLLS;

  // Broadcast to all connected clients
  io.emit('new-roll', entry);

  res.json({ ok: true });
});

// API: get current rolls
app.get('/api/rolls', (req, res) => {
  res.json(rolls);
});

// Live drop page
app.get('/live-drop', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'live-drop.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('CPH LiveDrop server running on port ' + PORT);
});
