import { joinRoom } from '@trystero-p2p/mqtt';
import { getBackendWebSocketUrl } from '../utils/urlHelper';

/**
 * Universal multi-environment signaling transport.
 * Works seamlessly across:
 * 1. Static serverless hosting like Vercel (via Trystero MQTT mesh)
 * 2. Dedicated Node.js WebSocket (AI Studio, Cloud Run, Localhost)
 * 3. Local browser BroadcastChannel (same-device multi-tab instant sync)
 */

export type SignalingCallback = (message: any) => void;

export class UniversalSignalingTransport {
  private localWs: WebSocket | null = null;
  private trysteroRoom: any = null;
  private sendTrysteroAction: ((data: any) => void) | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onMessageCallback: SignalingCallback | null = null;
  private roomId: string = '';
  private userId: string = '';
  private isClosed: boolean = false;
  private pingInterval: any = null;

  constructor(roomId: string, userId: string, onMessage: SignalingCallback) {
    this.roomId = roomId.trim().toLowerCase();
    this.userId = userId;
    this.onMessageCallback = onMessage;

    this.initBroadcastChannel();
    this.initTrysteroSignaling();
    this.initLocalWebSocket();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`infinitymeet_sig_${this.roomId}`);
        this.broadcastChannel.onmessage = (e) => {
          if (e.data && e.data._senderId !== this.userId) {
            this.onMessageCallback?.(e.data);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not available:', err);
      }
    }
  }

  private initTrysteroSignaling() {
    try {
      this.trysteroRoom = joinRoom({ appId: 'infinitymeet_twl_majlis' }, this.roomId);
      const [sendSignal, getSignal] = this.trysteroRoom.makeAction('sig');
      this.sendTrysteroAction = sendSignal;

      getSignal((data: any, peerId: string) => {
        if (!data || data._senderId === this.userId) return;
        this.onMessageCallback?.(data);
      });

      this.trysteroRoom.onPeerJoin((peerId: string) => {
        // Announce presence when new peer connects
        this.send({
          type: 'peer-joined-signaling',
          peerId,
          userId: this.userId,
        });
      });
    } catch (err) {
      console.warn('Trystero signaling init warning:', err);
    }
  }

  private initLocalWebSocket() {
    if (typeof window === 'undefined' || this.isClosed) return;

    const wsUrl = getBackendWebSocketUrl();
    if (!wsUrl) return;

    try {
      this.localWs = new WebSocket(wsUrl);

      this.localWs.onopen = () => {
        if (this.isClosed || !this.localWs) return;
        this.send({
          type: 'join',
          roomId: this.roomId,
          userId: this.userId,
        });

        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.localWs && this.localWs.readyState === WebSocket.OPEN) {
            this.localWs.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      this.localWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data._senderId !== this.userId) {
            this.onMessageCallback?.(data);
          }
        } catch (e) {
          // ignore
        }
      };

      this.localWs.onerror = () => {
        // Silent error handling; Trystero MQTT handles signaling if local WS is not running (e.g. Vercel)
      };

      this.localWs.onclose = () => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
      };
    } catch (e) {
      // ignore
    }
  }

  public send(msg: any) {
    if (this.isClosed) return;

    const payload = {
      ...msg,
      _senderId: this.userId,
      roomId: this.roomId,
    };

    // 1. Send via Trystero MQTT mesh (reaches peers across Vercel, external domains, mobile)
    if (this.sendTrysteroAction) {
      try {
        this.sendTrysteroAction(payload);
      } catch (e) {
        // ignore
      }
    }

    // 2. Send via local WebSocket if available (AI Studio / Cloud Run)
    if (this.localWs && this.localWs.readyState === WebSocket.OPEN) {
      try {
        this.localWs.send(JSON.stringify(payload));
      } catch (e) {
        // ignore
      }
    }

    // 3. Broadcast to same-origin tabs (instant multi-tab sync)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        // ignore
      }
    }
  }

  public close() {
    this.isClosed = true;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.trysteroRoom) {
      try {
        this.trysteroRoom.leave();
      } catch (e) {}
      this.trysteroRoom = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {}
      this.broadcastChannel = null;
    }

    if (this.localWs) {
      try {
        this.localWs.close();
      } catch (e) {}
      this.localWs = null;
    }
  }
}

