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

// Store last 50 rolls in memory
const rolls = [];
const MAX_ROLLS = 50;

// Formata chance como porcentagem
function formatChance(raw) {
  if (!raw) return '';
  const str = String(raw);
  if (str.includes('%')) return str;
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  if (num > 0 && num <= 1) return (num * 100).toFixed(2) + '%';
  if (num > 1 && num <= 100) return num.toFixed(2) + '%';
  return str;
}

const EXTENSION_KEY = process.env.EXTENSION_API_KEY || 'cph_biks_2025_drops_key';

function handleNewRoll(body, res) {
  const { rollId, userId, type, username, avatar, itemTo, itemFrom, itemsFrom, extraItemsCount, multiplier, caseName, caseImage, casePrice, pfRoll } = body;

  if (!rollId || !userId) {
    return res.status(400).json({ error: 'Missing rollId or userId' });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: String(userId),
    profileUrl: 'https://csgo.net/br/user/' + String(userId),
    username: String(username || 'Anônimo'),
    avatar: String(avatar || ''),
    type: String(type || 'case'),
    multiplier: multiplier || '',
    itemsFrom: Array.isArray(itemsFrom) ? itemsFrom : null,
    itemFrom: itemFrom || null,
    extraItemsCount: extraItemsCount || 0,
    itemTo: itemTo || null,
    pfRoll: pfRoll || null,
    caseName: caseName || '',
    caseUrl: caseName ? 'https://csgo.net/br/case/' + String(caseName) : '',
    caseImage: caseImage || '',
    casePrice: casePrice || '',
    rarityColor: '',
    timestamp: Date.now()
  };

  rolls.unshift(entry);
  if (rolls.length > MAX_ROLLS) rolls.length = MAX_ROLLS;
  io.emit('new-roll', entry);
  console.log('[API] ' + entry.type + ' | userId=' + entry.userId + ' | rollId=' + rollId);
  res.json({ ok: true });
}

// Rota usada pela extensão atual (com x-extension-key)
app.post('/api/drops/new', (req, res) => {
  if (req.headers['x-extension-key'] !== EXTENSION_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  handleNewRoll(req.body, res);
});

// Alias GET /api/drops → lista de rolls
app.get('/api/drops', (req, res) => res.json(rolls));

// API: receive a new roll (simplified format — from updated extension)
app.post('/api/rolls', (req, res) => {
  handleNewRoll(req.body, res);
});

// API: receive a new roll from the extension (legacy format)
app.post('/api/roll', (req, res) => {
  const { userId, type, username, avatar, multiplier, itemFrom, itemTo, pfRoll, caseName, rarityColor } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Missing type' });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: String(userId || ''),
    profileUrl: userId ? 'https://csgo.net/br/user/' + String(userId) : '',
    username: String(username || 'Anônimo'),
    avatar: String(avatar || ''),
    type: String(type || 'upgrade'),
    multiplier: formatChance(multiplier),
    itemFrom: itemFrom || null,
    itemTo: itemTo || null,
    pfRoll: pfRoll != null ? Number(pfRoll) : null,
    caseName: String(caseName || ''),
    caseUrl: caseName ? 'https://csgo.net/br/case/' + String(caseName) : '',
    rarityColor: String(rarityColor || ''),
    timestamp: Date.now()
  };

  rolls.unshift(entry);
  if (rolls.length > MAX_ROLLS) rolls.length = MAX_ROLLS;

  // Broadcast to all connected clients
  io.emit('new-roll', entry);

  console.log('[API] Roll:', entry.type, entry.username, entry.multiplier || '',
    entry.type === 'case' ? entry.itemTo?.name || '?' : (entry.itemFrom?.name || '?') + ' → ' + (entry.itemTo?.name || '?'));
  res.json({ ok: true });
});

// API: get current rolls
app.get('/api/rolls', (req, res) => {
  res.json(rolls);
});

// API: clear all rolls (for testing)
app.delete('/api/rolls', (req, res) => {
  rolls.length = 0;
  io.emit('clear');
  console.log('[API] All rolls cleared');
  res.json({ ok: true, message: 'All rolls cleared' });
});

// Also support POST for clearing (some proxies block DELETE)
app.post('/api/rolls/clear', (req, res) => {
  rolls.length = 0;
  io.emit('clear');
  console.log('[API] All rolls cleared (POST)');
  res.json({ ok: true, message: 'All rolls cleared' });
});

function sendLiveDropPage(req, res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'live-drop.html'));
}

// Live drop page
app.get('/live-drop', sendLiveDropPage);
app.get('/live-drop-v291', sendLiveDropPage);

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, rolls: rolls.length });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('CPH LiveDrop server running on port ' + PORT);
  console.log('Routes: POST /api/rolls (new) | POST /api/roll (legacy) | GET /live-drop');
});
