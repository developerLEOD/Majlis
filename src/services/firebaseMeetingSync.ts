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
import { db, handleFirestoreError, OperationType } from '../firebase';
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
    title: string;
    hostName: string;
    hostId: string;
    locked?: boolean;
    isRecording?: boolean;
  }) {
    const path = `rooms/${this.roomId}`;
    try {
      await setDoc(
        doc(db, 'rooms', this.roomId),
        {
          roomId: this.roomId,
          title: data.title || 'Live Majlis',
          hostName: data.hostName || 'Facilitator',
          hostId: data.hostId || this.userId,
          locked: !!data.locked,
          isRecording: !!data.isRecording,
          ended: false,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  }

  // When facilitator ends session for all, delete/mark ended
  public async endRoomSession() {
    const path = `rooms/${this.roomId}`;
    try {
      // 1. Mark ended first so any listeners fire sessionEnded immediately
      await setDoc(
        doc(db, 'rooms', this.roomId),
        {
          ended: true,
          endedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Delete participants
      const participantsSnap = await getDocs(collection(db, 'rooms', this.roomId, 'participants'));
      for (const d of participantsSnap.docs) {
        deleteDoc(d.ref).catch(() => {});
      }

      // 3. Delete room document completely so it's removed from directory
      setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'rooms', this.roomId));
        } catch (e) {}
      }, 500);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }

  // Listen to room metadata changes in real-time
  public subscribeToRoom(onUpdate: (data: any | null) => void): () => void {
    const path = `rooms/${this.roomId}`;
    const unsub = onSnapshot(
      doc(db, 'rooms', this.roomId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.ended) {
            onUpdate(null);
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
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
  }) {
    const path = `rooms/${this.roomId}/participants/${participant.id}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'participants', participant.id), {
        id: participant.id,
        name: participant.name,
        isHost: participant.isHost,
        isMuted: participant.isMuted,
        isVideoOff: participant.isVideoOff,
        isScreenSharing: !!participant.isScreenSharing,
        handRaised: !!participant.handRaised,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
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
  }) {
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

  // Remove participant upon leaving
  public async removeParticipant() {
    const path = `rooms/${this.roomId}/participants/${this.userId}`;
    try {
      await deleteDoc(doc(db, 'rooms', this.roomId, 'participants', this.userId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }

  // Listen to participants real-time
  public subscribeToParticipants(onUpdate: (participants: Participant[]) => void): () => void {
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
    const path = `rooms/${this.roomId}/messages`;
    const q = query(collection(db, 'rooms', this.roomId, 'messages'), limit(100));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const d = change.doc.data();
            if (d.senderId !== this.userId) {
              onMessage({
                id: d.id,
                senderId: d.senderId,
                senderName: d.senderName,
                text: d.text,
                isHost: !!d.isHost,
                timestamp: d.timestamp,
              });
            }
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
    const path = `rooms/${this.roomId}/reactions`;
    const q = query(collection(db, 'rooms', this.roomId, 'reactions'), limit(50));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const d = change.doc.data();
            if (d.senderId !== this.userId) {
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

// Global active rooms listener for the directory/home screen
export function subscribeToCloudActiveRooms(onUpdate: (rooms: MajlisSession[]) => void): () => void {
  const path = 'rooms';
  const q = query(collection(db, 'rooms'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: MajlisSession[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.roomId && d.title && !d.ended) {
          list.push({
            id: `live_${d.roomId}`,
            roomId: d.roomId,
            title: d.title,
            hostName: d.hostName || 'Facilitator',
            scheduledAt: 'Happening Now',
            status: 'live',
            participantCount: d.participantCount || 1,
            startedAt: d.createdAt ? d.createdAt.toMillis?.() || Date.now() : Date.now(),
            locked: !!d.locked,
          });
        }
      });
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}
