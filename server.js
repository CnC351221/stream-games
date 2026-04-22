/**
 * STREAM GAMES — ЕДИНЫЙ СЕРВЕР
 * Обслуживает все игры через один порт.
 * Маршруты: / → Main/index.html (главная оболочка)
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const { LiveChat } = require('youtube-chat');
const tmi = require('tmi.js');
const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── КОНФИГУРАЦИЯ ПОТОКОВ ────────────────────────────────────────────────────
// 1. TikTok
let tiktokUsername = '';
let tiktokConnection = null;

// 2. YouTube (ID канала)
let youtubeChannelId = '';
let youtubeLiveChat = null;

// 3. Twitch (Название канала)
let twitchChannel = '';
let twitchClient = null;

const PORT = 3000;
// ─────────────────────────────────────────────────────────────────────────────

// Статика: раздаём файлы из папки Main и из всего корня проекта
app.use(express.static(path.join(__dirname, 'Main')));
app.use(express.static(path.join(__dirname)));

// Главный маршрут → новая оболочка
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Main', 'index.html'));
});

// Оставляем старые маршруты для обратной совместимости
app.get('/peekh', (req, res) => {
    res.sendFile(path.join(__dirname, 'Main', 'index.html'));
});
app.get('/maph', (req, res) => {
    res.sendFile(path.join(__dirname, 'Main', 'index.html'));
});

// ─── КЭШ АВАТАРОК TWITCH ─────────────────────────────────────────────────────
const twitchAvatarCache = new Map();

function getTwitchAvatar(username) {
    return new Promise((resolve) => {
        if (twitchAvatarCache.has(username)) return resolve(twitchAvatarCache.get(username));
        https.get(`https://decapi.me/twitch/avatar/${username}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const url = data.trim();
                if (url.startsWith('http')) { twitchAvatarCache.set(username, url); resolve(url); }
                else resolve(null);
            });
        }).on('error', () => resolve(null));
    });
}

// ─── TIKTOK ──────────────────────────────────────────────────────────────────
function startTikTok(username) {
    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (e) { }
    }

    tiktokUsername = username;
    tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect()
        .then(() => {
            console.log(`✅ [TikTok] Подключено: ${username}`);
            io.emit('tiktok-status', { status: 'connected', user: username });
        })
        .catch(err => {
            console.error('❌ [TikTok] Ошибка:', err.message);
            io.emit('tiktok-status', { status: 'error', message: err.message });
        });

    tiktokConnection.on('chat', data => {
        io.emit('tiktok-msg', {
            user: data.uniqueId,
            text: data.comment,
            nickname: data.nickname,
            platform: 'tiktok',
            avatar: data.profilePictureUrl,
            isAuthor: data.uniqueId === tiktokUsername || (data.userDetails && data.userDetails.isModerator)
        });
    });

    tiktokConnection.on('gift', data => {
        // По просьбе пользователя: прокидываем подарки как обычные сообщения
        io.emit('tiktok-msg', {
            user: data.uniqueId,
            text: `🎁 ПОДАРОК: ${data.giftName} x${data.repeatCount}`,
            nickname: data.nickname,
            platform: 'tiktok',
            avatar: data.profilePictureUrl,
            isAuthor: false
        });
    });

    tiktokConnection.on('disconnected', () => console.log('⚠️ [TikTok] Соединение разорвано'));
    tiktokConnection.on('error', err => console.error('❌ [TikTok] Ошибка:', err));
}

// ─── YOUTUBE ─────────────────────────────────────────────────────────────────
function startYouTube(id) {
    if (youtubeLiveChat) {
        try { youtubeLiveChat.stop(); } catch (e) { }
    }

    youtubeChannelId = id;
    const startTime = Date.now();

    // Авто-определение типа (channelId, handle или liveId)
    let options = {};
    if (id.startsWith('UC')) {
        options = { channelId: id };
    } else if (id.startsWith('@')) {
        options = { handle: id };
    } else if (id.length === 11 && !id.includes(' ')) {
        options = { liveId: id };
    } else {
        options = { handle: '@' + id };
    }

    console.log(`📡 [YouTube] Попытка подключения (options: ${JSON.stringify(options)})`);
    youtubeLiveChat = new LiveChat(options);

    youtubeLiveChat.on('chat', chatItem => {
        const msgTime = new Date(chatItem.timestamp).getTime();
        if (msgTime < startTime) return;

        const text = chatItem.message.map(m => m.text || '').join('').trim();
        const isAuthor = chatItem.author.isChatOwner || chatItem.author.isChatModerator;

        console.log(`[YouTube] Сообщение от ${chatItem.author.name}: "${text}"`);

        io.emit('tiktok-msg', {
            user: chatItem.author.name,
            text,
            nickname: chatItem.author.name,
            platform: 'youtube',
            avatar: chatItem.author.thumbnail?.url,
            isAuthor
        });
    });

    youtubeLiveChat.start()
        .then(() => {
            console.log(`✅ [YouTube] Чат запущен: ${id}`);
            io.emit('youtube-status', { status: 'connected', user: id });
        })
        .catch(err => {
            console.error('❌ [YouTube] Ошибка:', err.message);
            io.emit('youtube-status', { status: 'error', message: err.message });
        });
}

// ─── TWITCH ───────────────────────────────────────────────────────────────────
function startTwitch(channel) {
    if (twitchClient) {
        try { twitchClient.disconnect(); } catch (e) { }
    }

    twitchChannel = channel;
    twitchClient = new tmi.Client({
        options: { debug: false },
        identity: {
            username: 'peekh_', // Бот
            password: 'oauth:uthc7maelx5x34yc0hc2mghjk57emz'
        },
        channels: [channel]
    });
    global.twitchClient = twitchClient;

    twitchClient.on('message', async (chan, tags, message, self) => {
        if (self) return;
        const username = tags['display-name'] || tags.username;
        const avatar = await getTwitchAvatar(tags.username);
        io.emit('tiktok-msg', {
            user: username,
            text: message,
            nickname: username,
            platform: 'twitch',
            avatar,
            isAuthor: (tags.badges && (tags.badges.broadcaster === '1' || tags.badges.moderator === '1'))
        });
    });

    twitchClient.connect()
        .then(() => {
            console.log(`✅ [Twitch] Подключено: ${channel}`);
            io.emit('twitch-status', { status: 'connected', user: channel });
        })
        .catch(err => {
            console.error('❌ [Twitch] Ошибка:', err.message);
            io.emit('twitch-status', { status: 'error', message: err.message });
        });
}

// Хелпер для аватарок Twitch (через официальный или сторонний API)
async function getTwitchAvatar(username) {
    // В идеале нужен ClientID/Secret, но для теста можно подставить заглушку или использовать dicebear
    return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}`;
}

// ─── ТЕСТОВЫЕ КОМАНДЫ ЧЕРЕЗ КОНСОЛЬ ─────────────────────────────────────────
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', line => {
    const text = line.trim();
    if (!text) return;
    io.emit('tiktok-msg', {
        user: 'AdminTest',
        text,
        nickname: 'Админ (Тест)',
        platform: 'system',
        isAuthor: true
    });
});

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('🎮 Клиент подключён');

    // Динамическое подключение к TikTok
    socket.on('set-tiktok-user', (username) => {
        console.log(`📡 Запрос на подключение TikTok: ${username}`);
        startTikTok(username);
    });

    socket.on('set-youtube-user', (id) => {
        console.log(`📡 Запрос на подключение YouTube: ${id}`);
        startYouTube(id);
    });

    socket.on('set-twitch-user', (name) => {
        console.log(`📡 Запрос на подключение Twitch: ${name}`);
        startTwitch(name);
    });

    socket.on('monster-found', (data) => {
        const { username, monsterId, platform } = data;
        const message = `@${username} ✅ №${monsterId} 🏆✨`;
        
        // Отправка в Twitch
        if (platform === 'twitch' && twitchClient) {
            twitchClient.say(twitchChannel, message)
                .catch(err => console.error('❌ [Twitch Send]', err));
        }
        
        // TikTok и YouTube обычно требуют больше прав/настроек для отправки сообщений,
        // поэтому пока выводим просто в консоль сервера.
        console.log(`🏆 [Event] ${username} нашел монстра ${monsterId} (${platform})`);
    });

    socket.on('disconnect', () => {
        console.log('👋 Клиент отключён');
    });
});

// ─── ЗАПУСК ───────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log('════════════════════════════════════════');
    console.log(`🚀 Stream Games сервер запущен`);
    console.log(`🌐 Открыть: http://localhost:${PORT}`);
    console.log(`📡 Ожидание подключения соцсетей через UI...`);
    console.log('════════════════════════════════════════');
});
