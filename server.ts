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
  isCoModerator?: boolean;
  socket: WebSocket;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
  isSpeaker?: boolean;
  joinedAt: number;
}

interface Room {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  locked: boolean;
  isRecording: boolean;
  spotlightUserId?: string | null;
  chatEnabled?: boolean;
  screenShareEnabled?: boolean;
  participants: Map<string, Participant>;
  kickedUsers?: Set<string>;
  createdAt: number;
}

// Store ONLY real, active rooms created by users
const rooms = new Map<string, Room>();
// Grace period timers for reconnecting users
const pendingDisconnects = new Map<string, NodeJS.Timeout>();

function getActiveRoomsList() {
  return Array.from(rooms.values())
    .filter((r) => r.participants.size > 0)
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

          // If there was a pending disconnect timer for this user, cancel it immediately
          if (pendingDisconnects.has(userId)) {
            clearTimeout(pendingDisconnects.get(userId)!);
            pendingDisconnects.delete(userId);
          }

          let room = rooms.get(roomId);
          if (!room) {
            room = {
              id: roomId,
              title: title || (isHost ? `${userName}'s Majlis` : 'Live Majlis'),
              hostId: isHost ? userId : '',
              hostName: isHost ? (userName || 'Moderator') : 'Facilitator',
              locked: false,
              isRecording: false,
              spotlightUserId: null,
              chatEnabled: true,
              screenShareEnabled: true,
              participants: new Map(),
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          } else if (room.kickedUsers?.has(userId)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'You have been removed from this meeting by the moderator.',
            }));
            return;
          } else if (room.locked && room.hostId !== userId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'This meeting is locked by the moderator.',
            }));
            return;
          }

          // A user becomes host if isHost is explicitly true OR if the room has no host yet
          const becomesHost = isHost === true || !room.hostId;
          if (becomesHost) {
            room.hostId = userId;
            if (userName) room.hostName = userName;
            if (title) room.title = title;
          }

          const participant: Participant = {
            id: userId,
            name: userName || 'Guest',
            isHost: becomesHost,
            isCoModerator: false,
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
              isCoModerator: !!p.isCoModerator,
              isSpeaker: !!p.isSpeaker,
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
            isCoModerator: participant.isCoModerator,
            title: room.title,
            hostName: room.hostName,
            locked: room.locked,
            isRecording: room.isRecording,
            spotlightUserId: room.spotlightUserId || null,
            chatEnabled: room.chatEnabled !== false,
            screenShareEnabled: room.screenShareEnabled !== false,
            participants: existingParticipants,
          }));

          // Notify everyone else that this user joined
          broadcastToRoom(roomId, userId, {
            type: 'user-joined',
            user: {
              id: participant.id,
              name: participant.name,
              isHost: participant.isHost,
              isCoModerator: participant.isCoModerator,
              isSpeaker: participant.isSpeaker,
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
          const { emoji, id } = message;
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
            id: id || ('react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
          };

          // Send only to OTHER participants so the sender does not receive a duplicate reaction
          for (const [pId, participant] of room.participants.entries()) {
            if (pId !== currentUserId && participant.socket.readyState === WebSocket.OPEN) {
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
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          for (const [pId, p] of room.participants.entries()) {
            if (pId !== currentUserId) {
              p.isMuted = true;
              if (p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(JSON.stringify({ type: 'force-mute' }));
              }
              broadcastToRoom(currentRoomId, null, {
                type: 'user-status-changed',
                userId: pId,
                isMuted: true,
              });
            }
          }

          broadcastToRoom(currentRoomId, null, {
            type: 'system-announcement',
            text: `${host?.name || 'Moderator'} muted all participants`,
          });
          break;
        }

        case 'host-mute-user': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isMuted = true;
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({ type: 'force-mute', targetId }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              isMuted: true,
            });
          }
          break;
        }

        case 'host-unmute-user': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isMuted = false;
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({ type: 'force-unmute', targetId }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              isMuted: false,
            });
          }
          break;
        }

        case 'host-stop-video': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isVideoOff = true;
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({ type: 'force-stop-video', targetId }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              isVideoOff: true,
            });
          }
          break;
        }

        case 'host-start-video': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isVideoOff = false;
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({ type: 'force-start-video', targetId }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              isVideoOff: false,
            });
          }
          break;
        }

        case 'host-stop-all-video': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          for (const [pId, p] of room.participants.entries()) {
            if (pId !== currentUserId) {
              p.isVideoOff = true;
              if (p.socket.readyState === WebSocket.OPEN) {
                p.socket.send(JSON.stringify({ type: 'force-stop-video' }));
              }
              broadcastToRoom(currentRoomId, null, {
                type: 'user-status-changed',
                userId: pId,
                isVideoOff: true,
              });
            }
          }

          broadcastToRoom(currentRoomId, null, {
            type: 'system-announcement',
            text: `${host?.name || 'Moderator'} stopped all attendee cameras`,
          });
          break;
        }

        case 'host-lower-all-hands': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          for (const [pId, p] of room.participants.entries()) {
            p.handRaised = false;
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: pId,
              handRaised: false,
            });
          }

          broadcastToRoom(currentRoomId, null, {
            type: 'hands-lowered',
            message: 'Moderator lowered all hands',
          });
          break;
        }

        case 'host-lower-hand': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

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
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          room.spotlightUserId = targetId || null;
          broadcastToRoom(currentRoomId, null, {
            type: 'spotlight-changed',
            targetId: room.spotlightUserId,
          });
          break;
        }

        case 'host-toggle-chat': {
          const { enabled } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          room.chatEnabled = !!enabled;
          broadcastToRoom(currentRoomId, null, {
            type: 'chat-permission-changed',
            enabled: room.chatEnabled,
          });
          break;
        }

        case 'host-toggle-screenshare': {
          const { enabled } = message;
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          room.screenShareEnabled = !!enabled;
          broadcastToRoom(currentRoomId, null, {
            type: 'screenshare-permission-changed',
            enabled: room.screenShareEnabled,
          });
          break;
        }

        case 'host-announcement': {
          const { text } = message;
          if (!currentRoomId || !currentUserId || !text?.trim()) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          broadcastToRoom(currentRoomId, null, {
            type: 'system-announcement',
            text: text.trim(),
            senderName: host?.name || 'Moderator',
          });
          break;
        }

        case 'host-toggle-comoderator': {
          const { targetId, isCoModerator } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isPrimaryHost = Boolean(host?.isHost || room.hostId === currentUserId);
          if (!isPrimaryHost) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isCoModerator = !!isCoModerator;
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({
                type: 'comoderator-status-changed',
                isCoModerator: target.isCoModerator,
                assignedBy: host?.name || 'Facilitator',
              }));
            }
            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: targetId,
              isCoModerator: target.isCoModerator,
            });
            broadcastToRoom(currentRoomId, null, {
              type: 'system-announcement',
              text: target.isCoModerator
                ? `${target.name} has been assigned as Co-Moderator`
                : `${target.name} is no longer a Co-Moderator`,
            });
            broadcastActiveRooms();
          }
          break;
        }

        case 'host-transfer': {
          const { targetId } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isPrimaryHost = Boolean(host?.isHost || room.hostId === currentUserId);
          if (!isPrimaryHost) return;

          const target = room.participants.get(targetId);
          if (target) {
            if (host) host.isHost = false;
            target.isHost = true;
            room.hostId = target.id;
            room.hostName = target.name;

            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({
                type: 'promoted-to-host',
                message: 'You have been appointed as the facilitator.',
              }));
            }

            if (host) {
              broadcastToRoom(currentRoomId, null, {
                type: 'user-status-changed',
                userId: host.id,
                isHost: false,
              });
            }

            broadcastToRoom(currentRoomId, null, {
              type: 'user-status-changed',
              userId: target.id,
              isHost: true,
            });

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
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          if (!room.kickedUsers) {
            room.kickedUsers = new Set();
          }
          room.kickedUsers.add(targetId);

          if (pendingDisconnects.has(targetId)) {
            clearTimeout(pendingDisconnects.get(targetId)!);
            pendingDisconnects.delete(targetId);
          }

          const target = room.participants.get(targetId);
          const targetName = target?.name || 'Participant';

          if (target) {
            if (target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify({
                type: 'kicked',
                targetId,
                message: 'You have been removed from the meeting by the moderator.',
              }));
              setTimeout(() => {
                try {
                  target.socket.close();
                } catch (e) {}
              }, 250);
            }
            room.participants.delete(targetId);
          }

          // Broadcast user-left to ALL participants in the room
          broadcastToRoom(currentRoomId, null, {
            type: 'user-left',
            userId: targetId,
            name: targetName,
            reason: 'removed by moderator',
          });

          broadcastToRoom(currentRoomId, null, {
            type: 'system-announcement',
            text: `${targetName} was dismissed from the Majlis.`,
          });

          broadcastActiveRooms();
          break;
        }

        case 'host-toggle-speaker': {
          const { targetId, isSpeaker } = message;
          if (!currentRoomId || !currentUserId || !targetId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          const target = room.participants.get(targetId);
          if (target) {
            target.isSpeaker = !!isSpeaker;
            broadcastToRoom(currentRoomId, null, {
              type: 'speaker-status-changed',
              userId: targetId,
              isSpeaker: !!isSpeaker,
            });
          }
          break;
        }

        case 'host-toggle-lock': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const host = room.participants.get(currentUserId);
          const isHostAuth = isAuthorizedHost(room, currentUserId);
          if (!isHostAuth) return;

          room.locked = message.locked !== undefined ? !!message.locked : !room.locked;
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

        case 'leave': {
          const { roomId, userId } = message;
          const targetRoomId = roomId || currentRoomId;
          const targetUserId = userId || currentUserId;
          if (targetRoomId && targetUserId) {
            if (pendingDisconnects.has(targetUserId)) {
              clearTimeout(pendingDisconnects.get(targetUserId)!);
              pendingDisconnects.delete(targetUserId);
            }
            performParticipantRemoval(targetRoomId, targetUserId);
          }
          break;
        }

        case 'host-end-session': {
          const targetRoomId = message.roomId || currentRoomId;
          if (!targetRoomId) return;
          const room = rooms.get(targetRoomId);
          if (room) {
            broadcastToRoom(targetRoomId, null, {
              type: 'session-ended',
              message: message.message || 'The facilitator has concluded this Majlis session.',
            });
            rooms.delete(targetRoomId);
          }
          broadcastActiveRooms();
          break;
        }
      }
    } catch (err) {
      console.error('Error handling ws message:', err);
    }
  });

  function performParticipantRemoval(roomId: string, userId: string) {
    const room = rooms.get(roomId);
    if (!room) return;

    const leavingUser = room.participants.get(userId);
    room.participants.delete(userId);

    broadcastToRoom(roomId, null, {
      type: 'user-left',
      userId,
      name: leavingUser?.name || 'A participant',
    });

    // If host leaves and there are participants left, assign next host
    if (room.hostId === userId && room.participants.size > 0) {
      const nextHost = room.participants.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        room.hostName = nextHost.name;
        if (nextHost.socket.readyState === WebSocket.OPEN) {
          nextHost.socket.send(
            JSON.stringify({
              type: 'promoted-to-host',
              message: 'You are now the meeting host.',
            })
          );
        }
        broadcastToRoom(roomId, null, {
          type: 'new-host',
          hostId: nextHost.id,
          hostName: nextHost.name,
        });
      }
    }

    if (room.participants.size === 0) {
      rooms.delete(roomId);
    }

    broadcastActiveRooms();
  }

  const cleanup = () => {
    if (currentRoomId && currentUserId) {
      const rId = currentRoomId;
      const uId = currentUserId;

      // Set a grace period timer (8 seconds) to allow brief network reconnection without dropping from room
      const timer = setTimeout(() => {
        pendingDisconnects.delete(uId);
        performParticipantRemoval(rId, uId);
      }, 8000);

      pendingDisconnects.set(uId, timer);
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

function isAuthorizedHost(room: Room, userId: string): boolean {
  const host = room.participants.get(userId);
  return Boolean(
    host?.isHost ||
    host?.isCoModerator ||
    room.hostId === userId ||
    !room.hostId ||
    room.hostId === '' ||
    room.hostId.startsWith('host_') ||
    room.participants.size <= 2
  );
}

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

// REST APIs & CORS
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

app.post('/api/clear-active-majalis', (req, res) => {
  rooms.clear();
  broadcastActiveRooms();
  res.json({ success: true, message: 'All active ongoing majalis cleared.' });
});

app.post('/api/end-majlis', (req, res) => {
  const { roomId } = req.body;
  if (roomId) {
    const cleanId = String(roomId).trim().toLowerCase();
    const room = rooms.get(cleanId);
    if (room) {
      broadcastToRoom(cleanId, null, {
        type: 'session-ended',
        message: 'The facilitator has concluded this Majlis session.',
      });
      rooms.delete(cleanId);
    }
    broadcastActiveRooms();
  }
  res.json({ success: true });
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
      hostId: '',
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
