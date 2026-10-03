import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  socket: WebSocket;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
  joinedAt: number;
}

interface Room {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  locked: boolean;
  isRecording: boolean;
  participants: Map<string, Participant>;
  createdAt: number;
}

// Store ONLY real, active rooms created by users
const rooms = new Map<string, Room>();

function getActiveRoomsList() {
  return Array.from(rooms.values())
    .filter((r) => r.participants.size > 0 || Date.now() - r.createdAt < 1000 * 60 * 10)
    .map((r) => ({
      id: `live_${r.id}`,
      roomId: r.id,
      title: r.title || 'Live Majlis',
      hostName: r.hostName || 'Facilitator',
      scheduledAt: 'Happening Now',
      status: 'live' as const,
      participantCount: r.participants.size,
      startedAt: r.createdAt,
      locked: r.locked,
    }));
}

function broadcastActiveRooms() {
  const activeList = getActiveRoomsList();
  const payload = JSON.stringify({
    type: 'active-majalis-update',
    activeMajalis: activeList,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;
  let isAlive = true;

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', (data: string) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping': {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          break;
        }

        case 'get-active-majalis': {
          const activeList = getActiveRoomsList();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'active-majalis-update',
              activeMajalis: activeList,
            }));
          }
          break;
        }

        case 'join': {
          const { roomId, userId, userName, isHost, title } = message;
          currentRoomId = roomId;
          currentUserId = userId;

          let room = rooms.get(roomId);
          if (!room) {
            room = {
              id: roomId,
              title: title || (isHost ? `${userName}'s Majlis` : 'Live Majlis'),
              hostId: userId,
              hostName: userName || 'Facilitator',
              locked: false,
              isRecording: false,
              participants: new Map(),
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          } else if (room.locked && room.hostId !== userId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'This meeting is locked by the moderator.',
            }));
            return;
          }

          // If user joins with host status or room has no host
          const becomesHost = isHost || room.hostId === userId || room.participants.size === 0;
          if (becomesHost) {
            room.hostId = userId;
            if (userName) room.hostName = userName;
            if (title) room.title = title;
          }

          const participant: Participant = {
            id: userId,
            name: userName || 'Guest',
            isHost: becomesHost,
            socket: ws,
            isMuted: !!message.isMuted,
            isVideoOff: !!message.isVideoOff,
            isScreenSharing: false,
            handRaised: false,
            joinedAt: Date.now(),
          };

          room.participants.set(userId, participant);

          // Return list of all current participants to the new user
          const existingParticipants = Array.from(room.participants.values())
            .filter((p) => p.id !== userId)
            .map((p) => ({
              id: p.id,
              name: p.name,
              isHost: p.isHost,
              isMuted: p.isMuted,
              isVideoOff: p.isVideoOff,
              isScreenSharing: p.isScreenSharing,
              handRaised: p.handRaised,
            }));

          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId,
            userId,
            isHost: participant.isHost,
            title: room.title,
            hostName: room.hostName,
            locked: room.locked,
            isRecording: room.isRecording,
            participants: existingParticipants,
          }));

          // Notify everyone else that this user joined
          broadcastToRoom(roomId, userId, {
            type: 'user-joined',
            user: {
              id: participant.id,
              name: participant.name,
              isHost: participant.isHost,
              isMuted: participant.isMuted,
              isVideoOff: participant.isVideoOff,
              isScreenSharing: participant.isScreenSharing,
              handRaised: participant.handRaised,
            },
          });

          // Broadcast active rooms update to lobby/home screens
          broadcastActiveRooms();
          break;
        }

        case 'signal': {
          const { targetId, signalData } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const target = room.participants.get(targetId);
          if (target && target.socket.readyState === WebSocket.OPEN) {
            target.socket.send(JSON.stringify({
              type: 'signal',
              senderId: currentUserId,
              signalData,
            }));
          }
          break;
        }

        case 'chat': {
          const { text } = message;
          if (!currentRoomId || !currentUserId || !text?.trim()) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.participants.get(currentUserId);
          if (!sender) return;

          const chatPayload = {
            type: 'chat',
            message: {
              id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              senderId: sender.id,
              senderName: sender.name,
              isHost: sender.isHost,
              text: text.trim(),
              timestamp: Date.now(),
            },
          };

          for (const participant of room.participants.values()) {
            if (participant.socket.readyState === WebSocket.OPEN) {
              participant.socket.send(JSON.stringify(chatPayload));
            }
          }
          break;
        }

        case 'reaction': {
          const { emoji } = message;
          if (!currentRoomId || !currentUserId || !emoji) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.participants.get(currentUserId);
          if (!sender) return;

          const reactionPayload = {
            type: 'reaction',
            senderId: sender.id,
            senderName: sender.name,
            emoji,
            id: 'react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          };

          for (const participant of room.participants.values()) {
            if (participant.socket.readyState === WebSocket.OPEN) {
              participant.socket.send(JSON.stringify(reactionPayload));
            }
          }
          break;
        }

        case 'status-update': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.participants.get(currentUserId);
          if (!sender) return;

          if (message.isMuted !== undefined) sender.isMuted = message.isMuted;
          if (message.isVideoOff !== undefined) sender.isVideoOff = message.isVideoOff;
          if (message.isScreenSharing !== undefined) sender.isScreenSharing = message.isScreenSharing;
          if (message.handRaised !== undefined) sender.handRaised = message.handRaised;

          broadcastToRoom(currentRoomId, null, {
            type: 'user-status-changed',
            userId: sender.id,
            isMuted: sender.isMuted,
            isVideoOff: sender.isVideoOff,
            isScreenSharing: sender.isScreenSharing,
            handRaised: sender.handRaised,
          });
          break;
        }

        case 'host-mute-all': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          for (const [pId, p] of room.participants.entries()) {
            if (pId !== currentUserId) {
              p.isMuted = true;
              if (p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(JSON.stringify({ type: 'force-mute' }));
              }
            }
          }

          broadcastToRoom(currentRoomId, null, {
            type: 'system-announcement',
            text: 'Facilitator has muted all participants',
          });
          break;
        }

        case 'host-mute-user': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isMuted = true;
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({ type: 'force-mute' }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              isMuted: true,
            });
          }
          break;
        }

        case 'host-lower-all-hands': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          for (const p of room.participants.values()) {
            p.handRaised = false;
          }

          broadcastToRoom(currentRoomId, null, {
            type: 'hands-lowered',
            message: 'Facilitator lowered all hands',
          });
          break;
        }

        case 'host-lower-hand': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.handRaised = false;
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              handRaised: false,
            });
          }
          break;
        }

        case 'host-spotlight': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          broadcastToRoom(currentRoomId, null, {
            type: 'spotlight-changed',
            targetId: targetId || null,
          });
          break;
        }

        case 'host-toggle-chat': {
          const { enabled } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          broadcastToRoom(currentRoomId, null, {
            type: 'chat-permission-changed',
            enabled: !!enabled,
          });
          break;
        }

        case 'host-toggle-screenshare': {
          const { enabled } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          broadcastToRoom(currentRoomId, null, {
            type: 'screenshare-permission-changed',
            enabled: !!enabled,
          });
          break;
        }

        case 'host-announcement': {
          const { text } = message;
          if (!currentRoomId || !currentUserId || !text?.trim()) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          broadcastToRoom(currentRoomId, null, {
            type: 'system-announcement',
            text: text.trim(),
            senderName: host.name,
          });
          break;
        }

        case 'host-transfer': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          const target = room.participants.get(targetId);
          if (target) {
            host.isHost = false;
            target.isHost = true;
            room.hostId = target.id;
            room.hostName = target.name;

            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({
                type: 'promoted-to-host',
                message: 'You have been appointed as the facilitator.',
              }));
            }

            broadcastToRoom(currentRoomId, null, {
              type: 'new-host',
              hostId: target.id,
              hostName: target.name,
            });
            broadcastActiveRooms();
          }
          break;
        }

        case 'host-kick': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          const target = room.participants.get(targetId);
          if (target) {
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({
                type: 'kicked',
                message: 'You have been removed from the meeting by the moderator.',
              }));
              target.socket.close();
            }
            room.participants.delete(targetId);
            broadcastToRoom(currentRoomId, null, {
              type: 'user-left',
              userId: targetId,
              name: target.name,
              reason: 'removed by moderator',
            });
            broadcastActiveRooms();
          }
          break;
        }

        case 'host-toggle-lock': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          if (!host?.isHost) return;

          room.locked = !room.locked;
          broadcastToRoom(currentRoomId, null, {
            type: 'room-lock-changed',
            locked: room.locked,
          });
          broadcastActiveRooms();
          break;
        }

        case 'recording-notice': {
          const { isRecording } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.participants.get(currentUserId);
          if (!sender?.isHost) return;

          room.isRecording = !!isRecording;
          broadcastToRoom(currentRoomId, null, {
            type: 'recording-notice',
            isRecording: room.isRecording,
            recordedBy: sender.name,
          });
          break;
        }

        case 'host-end-session': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.participants.get(currentUserId);
          if (!sender?.isHost) return;

          broadcastToRoom(currentRoomId, currentUserId, {
            type: 'session-ended',
            message: 'The facilitator has concluded this Majlis session.',
          });
          rooms.delete(currentRoomId);
          broadcastActiveRooms();
          break;
        }
      }
    } catch (err) {
      console.error('Error handling ws message:', err);
    }
  });

  const cleanup = () => {
    if (currentRoomId && currentUserId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const leavingUser = room.participants.get(currentUserId);
        room.participants.delete(currentUserId);

        broadcastToRoom(currentRoomId, null, {
          type: 'user-left',
          userId: currentUserId,
          name: leavingUser?.name || 'A participant',
        });

        // If host leaves and there are participants left, assign next host
        if (room.hostId === currentUserId && room.participants.size > 0) {
          const nextHost = room.participants.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            room.hostId = nextHost.id;
            room.hostName = nextHost.name;
            if (nextHost.socket.readyState === WebSocket.OPEN) {
              nextHost.socket.send(JSON.stringify({
                type: 'promoted-to-host',
                message: 'You are now the meeting host.',
              }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'new-host',
              hostId: nextHost.id,
              hostName: nextHost.name,
            });
          }
        }

        if (room.participants.size === 0) {
          rooms.delete(currentRoomId);
        }

        broadcastActiveRooms();
      }
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// Periodic heartbeat check
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

function broadcastToRoom(roomId: string, excludeUserId: string | null, payload: object) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const [userId, participant] of room.participants.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    if (participant.socket.readyState === WebSocket.OPEN) {
      participant.socket.send(msg);
    }
  }
}

// REST APIs
app.use(express.json());

app.get('/api/config', (req, res) => {
  const host = req.get('host');
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol || 'http';
  const requestUrl = `${protocol}://${host}`;

  res.json({
    appUrl: process.env.APP_URL || requestUrl,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/active-majalis', (req, res) => {
  res.json({ activeMajalis: getActiveRoomsList() });
});

app.post('/api/create-majlis', (req, res) => {
  const { roomId, title, hostName } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      title: title || 'Live Majlis',
      hostId: 'host_' + Date.now(),
      hostName: hostName || 'Facilitator',
      locked: false,
      isRecording: false,
      participants: new Map(),
      createdAt: Date.now(),
    };
    rooms.set(roomId, room);
  } else {
    if (title) room.title = title;
    if (hostName) room.hostName = hostName;
  }

  broadcastActiveRooms();
  res.json({ success: true, room: { id: room.id, title: room.title, hostName: room.hostName } });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.json({ exists: false });
    return;
  }
  res.json({
    exists: true,
    title: room.title,
    hostName: room.hostName,
    participantCount: room.participants.size,
    locked: room.locked,
    isRecording: room.isRecording,
  });
});

// Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
