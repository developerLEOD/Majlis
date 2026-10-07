import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, isFirestoreQuotaExhausted, OperationType } from '../firebase';
import { ChatMessage, MajlisSession, Participant, ReactionItem } from '../types/meeting';

export class FirebaseMeetingSync {
  private roomId: string;
  private userId: string;
  private unsubscribers: (() => void)[] = [];

  constructor(roomId: string, userId: string) {
    this.roomId = roomId.trim().toLowerCase();
    this.userId = userId;
  }

  // Register or update the room in cloud
  public async setRoom(data: {
    title?: string;
    hostName?: string;
    hostId?: string;
    locked?: boolean;
    isRecording?: boolean;
    spotlightUserId?: string | null;
    chatEnabled?: boolean;
    screenShareEnabled?: boolean;
    announcement?: { text: string; senderName?: string } | null;
  }) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}`;
    try {
      const updatePayload: any = {
        roomId: this.roomId,
        ended: false,
        updatedAt: serverTimestamp(),
      };
      if (data.title !== undefined) updatePayload.title = data.title;
      if (data.hostName !== undefined) updatePayload.hostName = data.hostName;
      if (data.hostId !== undefined) updatePayload.hostId = data.hostId;
      if (data.locked !== undefined) updatePayload.locked = data.locked;
      if (data.isRecording !== undefined) updatePayload.isRecording = data.isRecording;
      if (data.spotlightUserId !== undefined) updatePayload.spotlightUserId = data.spotlightUserId;
      if (data.chatEnabled !== undefined) updatePayload.chatEnabled = data.chatEnabled;
      if (data.screenShareEnabled !== undefined) updatePayload.screenShareEnabled = data.screenShareEnabled;
      if (data.announcement !== undefined) updatePayload.announcement = data.announcement;

      await setDoc(doc(db, 'rooms', this.roomId), updatePayload, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  // When facilitator ends session for all, delete/mark ended
  public async endRoomSession() {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}`;
    try {
      // 1. Mark ended first so any listeners fire sessionEnded immediately
      await setDoc(
        doc(db, 'rooms', this.roomId),
        {
          ended: true,
          endedAt: serverTimestamp(),
          participantCount: 0,
        },
        { merge: true }
      ).catch(() => {});

      // 2. Delete participants
      const participantsSnap = await getDocs(collection(db, 'rooms', this.roomId, 'participants')).catch(() => null);
      if (participantsSnap) {
        for (const d of participantsSnap.docs) {
          deleteDoc(d.ref).catch(() => {});
        }
      }

      // 3. Immediately delete room document
      await deleteDoc(doc(db, 'rooms', this.roomId)).catch(() => {});
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }

  // Listen to room metadata changes in real-time
  public subscribeToRoom(onUpdate: (data: any | null) => void): () => void {
    if (isFirestoreQuotaExhausted) return () => {};
    const path = `rooms/${this.roomId}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', this.roomId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.ended) {
            onUpdate({ ...data, ended: true });
          } else {
            onUpdate(data);
          }
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    this.unsubscribers.push(unsub);
    return unsub;
  }

  // Register participant in cloud
  public async setParticipant(participant: {
    id: string;
    name: string;
    isHost: boolean;
    isCoModerator?: boolean;
    isSpeaker?: boolean;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
  }) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/participants/${participant.id}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'participants', participant.id), {
        id: participant.id,
        name: participant.name,
        isHost: !!participant.isHost,
        isCoModerator: !!participant.isCoModerator,
        isSpeaker: !!participant.isSpeaker,
        isMuted: !!participant.isMuted,
        isVideoOff: !!participant.isVideoOff,
        isScreenSharing: !!participant.isScreenSharing,
        handRaised: !!participant.handRaised,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      }, { merge: true });

      // Update room document with active state
      await setDoc(
        doc(db, 'rooms', this.roomId),
        {
          ended: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  // Update participant status (mute, video, hand raise)
  public async updateParticipantStatus(status: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
    isHost?: boolean;
    isCoModerator?: boolean;
    isSpeaker?: boolean;
  }) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/participants/${this.userId}`;
    try {
      await setDoc(
        doc(db, 'rooms', this.roomId, 'participants', this.userId),
        {
          ...status,
          lastSeen: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  }

  // Update specific participant status (e.g. moderator actions)
  public async updateParticipantStatusForUser(userId: string, status: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
    isHost?: boolean;
    isCoModerator?: boolean;
    isSpeaker?: boolean;
  }) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/participants/${userId}`;
    try {
      await setDoc(
        doc(db, 'rooms', this.roomId, 'participants', userId),
        {
          ...status,
          lastSeen: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  }

  // Remove participant upon leaving
  public async removeParticipant() {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/participants/${this.userId}`;
    try {
      await deleteDoc(doc(db, 'rooms', this.roomId, 'participants', this.userId)).catch(() => {});
      const remainingSnap = await getDocs(collection(db, 'rooms', this.roomId, 'participants')).catch(() => null);
      if (remainingSnap && remainingSnap.empty) {
        await deleteDoc(doc(db, 'rooms', this.roomId)).catch(() => {});
      } else if (remainingSnap) {
        await setDoc(
          doc(db, 'rooms', this.roomId),
          { participantCount: remainingSnap.size, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }

  // Moderator removes / dismisses a participant from Firestore
  public async deleteParticipant(targetId: string) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/participants/${targetId}`;
    try {
      await deleteDoc(doc(db, 'rooms', this.roomId, 'participants', targetId)).catch(() => {});
      const remainingSnap = await getDocs(collection(db, 'rooms', this.roomId, 'participants')).catch(() => null);
      if (remainingSnap && remainingSnap.empty) {
        await deleteDoc(doc(db, 'rooms', this.roomId)).catch(() => {});
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }

  // Mark participant as kicked in cloud so all clients & reconnect attempts know
  public async markKicked(targetId: string) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/kicked/${targetId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'kicked', targetId), {
        userId: targetId,
        kickedAt: Date.now(),
        kickedBy: this.userId,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  // Subscribe to kick notices for this user
  public subscribeToKicked(onKicked: () => void): () => void {
    if (isFirestoreQuotaExhausted) return () => {};
    const path = `rooms/${this.roomId}/kicked/${this.userId}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', this.roomId, 'kicked', this.userId),
      (snap) => {
        if (snap.exists()) {
          onKicked();
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    this.unsubscribers.push(unsub);
    return unsub;
  }

  // Listen to participants real-time
  public subscribeToParticipants(onUpdate: (participants: Participant[]) => void): () => void {
    if (isFirestoreQuotaExhausted) return () => {};
    const path = `rooms/${this.roomId}/participants`;
    const colRef = collection(db, 'rooms', this.roomId, 'participants');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: Participant[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: d.id,
            name: d.name,
            isHost: !!d.isHost,
            isCoModerator: !!d.isCoModerator,
            isSpeaker: !!d.isSpeaker,
            isLocal: d.id === this.userId,
            isMuted: !!d.isMuted,
            isVideoOff: !!d.isVideoOff,
            isScreenSharing: !!d.isScreenSharing,
            handRaised: !!d.handRaised,
          });
        });
        onUpdate(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    this.unsubscribers.push(unsub);
    return unsub;
  }

  // WebRTC Signaling via Firestore
  public async sendSignal(targetId: string, signalData: any) {
    if (isFirestoreQuotaExhausted) return;
    const signalId = `sig_${this.userId}_to_${targetId}_${Date.now()}`;
    const path = `rooms/${this.roomId}/signals/${signalId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'signals', signalId), {
        senderId: this.userId,
        targetId,
        signalData: JSON.stringify(signalData),
        timestamp: Date.now(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  // Subscribe to signals intended for this user
  public subscribeToSignals(onSignal: (senderId: string, signalData: any) => void): () => void {
    if (isFirestoreQuotaExhausted) return () => {};
    const path = `rooms/${this.roomId}/signals`;
    const q = query(
      collection(db, 'rooms', this.roomId, 'signals'),
      where('targetId', '==', this.userId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            try {
              const parsed = JSON.parse(data.signalData);
              onSignal(data.senderId, parsed);
              deleteDoc(change.doc.ref).catch(() => {});
            } catch (e) {}
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    this.unsubscribers.push(unsub);
    return unsub;
  }

  // Chat via Firestore
  public async sendChatMessage(message: ChatMessage) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/messages/${message.id}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'messages', message.id), {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        isHost: !!message.isHost,
        timestamp: message.timestamp || Date.now(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  public subscribeToChatMessages(onMessage: (message: ChatMessage) => void): () => void {
    if (isFirestoreQuotaExhausted) return () => {};
    const path = `rooms/${this.roomId}/messages`;
    const q = query(collection(db, 'rooms', this.roomId, 'messages'), limit(100));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const d = change.doc.data();
            onMessage({
              id: d.id,
              senderId: d.senderId,
              senderName: d.senderName,
              text: d.text,
              isHost: !!d.isHost,
              timestamp: d.timestamp,
            });
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    this.unsubscribers.push(unsub);
    return unsub;
  }

  // Live emoji reactions via Firestore
  public async sendReaction(reaction: ReactionItem) {
    if (isFirestoreQuotaExhausted) return;
    const path = `rooms/${this.roomId}/reactions/${reaction.id}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'reactions', reaction.id), {
        id: reaction.id,
        senderId: reaction.senderId,
        senderName: reaction.senderName,
        emoji: reaction.emoji,
        timestamp: Date.now(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  public subscribeToReactions(onReaction: (reaction: ReactionItem) => void): () => void {
    if (isFirestoreQuotaExhausted) return () => {};
    const path = `rooms/${this.roomId}/reactions`;
    const q = query(collection(db, 'rooms', this.roomId, 'reactions'), limit(50));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const d = change.doc.data();
            onReaction({
              id: d.id,
              senderId: d.senderId,
              senderName: d.senderName,
              emoji: d.emoji,
            });
            setTimeout(() => {
              deleteDoc(change.doc.ref).catch(() => {});
            }, 4000);
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    this.unsubscribers.push(unsub);
    return unsub;
  }

  public destroy() {
    this.removeParticipant().catch(() => {});
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }
}

// Create or register a live room document directly in Firestore
export async function createCloudRoom(session: {
  roomId: string;
  title: string;
  hostName: string;
  hostId?: string;
}): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const cleanRoomId = session.roomId.trim().toLowerCase();
  const path = `rooms/${cleanRoomId}`;
  try {
    await setDoc(
      doc(db, 'rooms', cleanRoomId),
      {
        roomId: cleanRoomId,
        title: session.title || 'Live Majlis',
        hostName: session.hostName || 'Facilitator',
        hostId: session.hostId || '',
        ended: false,
        participantCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
}

// Global active rooms listener for the directory/home screen
export function subscribeToCloudActiveRooms(onUpdate: (rooms: MajlisSession[]) => void): () => void {
  if (isFirestoreQuotaExhausted) {
    onUpdate([]);
    return () => {};
  }
  const path = 'rooms';
  const q = query(collection(db, 'rooms'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: MajlisSession[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || !d.roomId) return;

        const isEnded = Boolean(d.ended);
        const count = typeof d.participantCount === 'number' ? d.participantCount : 0;
        const createdTime = d.createdAt ? (d.createdAt.toMillis?.() || Date.now()) : Date.now();
        const updatedTime = d.updatedAt ? (d.updatedAt.toMillis?.() || createdTime) : createdTime;
        // Consider stale if inactive for over 15 minutes or count is 0 or marked ended
        const isStale = (now - updatedTime > 1000 * 60 * 15);

        if (isEnded || isStale || count <= 0) {
          if (!isFirestoreQuotaExhausted) {
            deleteDoc(docSnap.ref).catch(() => {});
          }
          return;
        }

        list.push({
          id: `live_${d.roomId}`,
          roomId: d.roomId,
          title: d.title || 'Live Majlis',
          hostName: d.hostName || 'Facilitator',
          scheduledAt: 'Happening Now',
          status: 'live',
          participantCount: Math.max(count, 1),
          startedAt: createdTime,
          locked: !!d.locked,
        });
      });
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function clearAllCloudActiveRooms(): Promise<void> {
  const path = 'rooms';
  try {
    const snapshot = await getDocs(collection(db, 'rooms'));
    const promises = snapshot.docs.map(async (docSnap) => {
      const participantsSnap = await getDocs(collection(db, 'rooms', docSnap.id, 'participants')).catch(() => null);
      if (participantsSnap) {
        participantsSnap.docs.forEach((pDoc) => deleteDoc(pDoc.ref).catch(() => {}));
      }
      return deleteDoc(docSnap.ref);
    });
    await Promise.all(promises);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
}

export async function endCloudRoomSession(roomId: string): Promise<void> {
  const cleanRoomId = roomId.trim().toLowerCase();
  const path = `rooms/${cleanRoomId}`;
  try {
    const participantsSnap = await getDocs(collection(db, 'rooms', cleanRoomId, 'participants')).catch(() => null);
    if (participantsSnap) {
      for (const d of participantsSnap.docs) {
        deleteDoc(d.ref).catch(() => {});
      }
    }
    await deleteDoc(doc(db, 'rooms', cleanRoomId)).catch(() => {});
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
}

export const DEFAULT_UPCOMING_SESSIONS: MajlisSession[] = [
  {
    id: 'up_1',
    roomId: 'quran-tafsir-04',
    title: 'The Exegesis of the Noble Quran',
    hostName: 'Sana Amjad',
    scheduledAt: 'Today · 8:00 PM',
    status: 'upcoming',
    participantCount: 0,
  },
  {
    id: 'up_2',
    roomId: 'adab-fahm-02',
    title: 'Adab & Fahm al-Din',
    hostName: 'Rahim Muhammad Syed',
    scheduledAt: 'Tomorrow · 7:30 PM',
    status: 'upcoming',
    participantCount: 0,
  },
  {
    id: 'up_3',
    roomId: 'abu-bakr-audio-01',
    title: 'Abu Bakr RA — Early Life & Legacy',
    hostName: 'Sheikh Anwar Al-Awlaki',
    scheduledAt: 'Sat, 12 Oct · 8:00 PM',
    status: 'upcoming',
    participantCount: 0,
  },
];

export function subscribeToScheduledSessions(onUpdate: (sessions: MajlisSession[]) => void): () => void {
  if (isFirestoreQuotaExhausted) {
    onUpdate(DEFAULT_UPCOMING_SESSIONS);
    return () => {};
  }
  const path = 'scheduled_sessions';
  const q = query(collection(db, 'scheduled_sessions'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(DEFAULT_UPCOMING_SESSIONS);
        return;
      }
      const list: MajlisSession[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.roomId) {
          list.push({
            id: docSnap.id,
            roomId: d.roomId,
            title: d.title || 'Scheduled Majlis',
            hostName: d.hostName || 'Facilitator',
            scheduledAt: d.scheduledAt || 'Scheduled Gathering',
            status: 'upcoming',
            participantCount: 0,
            startedAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
          });
        }
      });
      onUpdate(list.length > 0 ? list : DEFAULT_UPCOMING_SESSIONS);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      onUpdate(DEFAULT_UPCOMING_SESSIONS);
    }
  );
}

export async function createScheduledSession(session: {
  roomId: string;
  title: string;
  hostName: string;
  scheduledAt: string;
  series?: string;
}): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const cleanId = `sched_${session.roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  const path = `scheduled_sessions/${cleanId}`;
  try {
    await setDoc(
      doc(db, 'scheduled_sessions', cleanId),
      {
        id: cleanId,
        roomId: session.roomId.trim().toLowerCase(),
        title: session.title.trim(),
        hostName: session.hostName.trim() || 'Facilitator',
        scheduledAt: session.scheduledAt.trim() || 'Scheduled Gathering',
        series: session.series || '',
        status: 'upcoming',
        createdAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
}

export async function deleteScheduledSession(sessionId: string): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  const cleanId = sessionId.trim();
  const path = `scheduled_sessions/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'scheduled_sessions', cleanId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, path);
  }
}
