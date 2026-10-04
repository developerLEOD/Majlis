import { RecordingResult } from '../types/meeting';
import { createMixedAudioStream } from '../utils/media';

export type RecordingMode = 'composite' | 'screen';

export interface RecorderOptions {
  roomId: string;
  mode: RecordingMode;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  participants: { id: string; name: string; isMuted: boolean; isVideoOff: boolean; stream?: MediaStream }[];
  onTick?: (durationSeconds: number, currentSizeBytes: number) => void;
  onStatusChange?: (status: 'recording' | 'paused' | 'stopped') => void;
}

export class LocalMeetingRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime = 0;
  private pausedDuration = 0;
  private pauseStartTime = 0;
  private timerInterval: number | null = null;
  private canvasAnimFrame: number | null = null;
  private screenStream: MediaStream | null = null;
  private audioCleanup: (() => void) | null = null;
  private options: RecorderOptions;
  private canvas: HTMLCanvasElement | null = null;
  private currentSizeBytes = 0;
  private internalVideos: Map<string, HTMLVideoElement> = new Map();

  public status: 'idle' | 'recording' | 'paused' | 'stopped' = 'idle';

  constructor(options: RecorderOptions) {
    this.options = options;
  }

  public async start(): Promise<void> {
    this.recordedChunks = [];
    this.currentSizeBytes = 0;
    this.startTime = Date.now();
    this.pausedDuration = 0;

    let recordingStream: MediaStream;

    if (this.options.mode === 'screen') {
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: true,
        });
      } catch (err) {
        console.error('Screen capture rejected or cancelled:', err);
        throw new Error('Screen capture was cancelled or not permitted.');
      }

      const audioStreamsToMix: MediaStream[] = [];
      if (this.options.localStream) audioStreamsToMix.push(this.options.localStream);
      this.options.remoteStreams.forEach((s) => audioStreamsToMix.push(s));
      if (this.screenStream.getAudioTracks().length > 0) {
        audioStreamsToMix.push(this.screenStream);
      }

      const { mixedStream, cleanup } = createMixedAudioStream(audioStreamsToMix);
      this.audioCleanup = cleanup;

      recordingStream = new MediaStream();
      this.screenStream.getVideoTracks().forEach((track) => recordingStream.addTrack(track));
      mixedStream.getAudioTracks().forEach((track) => recordingStream.addTrack(track));

      this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        if (this.status === 'recording' || this.status === 'paused') {
          this.stop();
        }
      });
    } else {
      // Initialize internal video elements for each participant stream
      this.internalVideos.clear();
      this.options.participants.forEach((p) => {
        if (p.stream) {
          const v = document.createElement('video');
          v.srcObject = p.stream;
          v.muted = true;
          v.playsInline = true;
          v.autoplay = true;
          v.play().catch(() => {});
          this.internalVideos.set(p.id, v);
        }
      });

      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      const ctx = this.canvas.getContext('2d')!;

      const drawMeetingComposite = () => {
        if (this.status === 'stopped') return;

        const w = this.canvas!.width;
        const h = this.canvas!.height;

        // Dark background
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);

        const participantsList = this.options.participants;
        const count = participantsList.length;

        if (count === 0) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(40, 40, w - 80, h - 80);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '24px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Majlis Session in Progress', w / 2, h / 2);
        } else if (count === 1) {
          const p = participantsList[0];
          const video = p.isVideoOff ? null : (this.internalVideos.get(p.id) || null);
          this.drawVideoTile(ctx, video, p.name, p.isMuted, 20, 20, w - 40, h - 40);
        } else if (count === 2) {
          const tileW = (w - 60) / 2;
          const tileH = h - 60;
          const p0 = participantsList[0];
          const p1 = participantsList[1];
          this.drawVideoTile(
            ctx,
            p0.isVideoOff ? null : (this.internalVideos.get(p0.id) || null),
            p0.name,
            p0.isMuted,
            20,
            30,
            tileW,
            tileH
          );
          this.drawVideoTile(
            ctx,
            p1.isVideoOff ? null : (this.internalVideos.get(p1.id) || null),
            p1.name,
            p1.isMuted,
            40 + tileW,
            30,
            tileW,
            tileH
          );
        } else if (count <= 4) {
          const tileW = (w - 60) / 2;
          const tileH = (h - 60) / 2;
          participantsList.forEach((p, idx) => {
            const row = Math.floor(idx / 2);
            const col = idx % 2;
            const x = 20 + col * (tileW + 20);
            const y = 20 + row * (tileH + 20);
            const video = p.isVideoOff ? null : (this.internalVideos.get(p.id) || null);
            this.drawVideoTile(ctx, video, p.name, p.isMuted, x, y, tileW, tileH);
          });
        } else {
          const cols = 3;
          const rows = Math.ceil(count / cols);
          const tileW = (w - 20 * (cols + 1)) / cols;
          const tileH = (h - 20 * (rows + 1)) / rows;
          participantsList.forEach((p, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const x = 20 + col * (tileW + 20);
            const y = 20 + row * (tileH + 20);
            const video = p.isVideoOff ? null : (this.internalVideos.get(p.id) || null);
            this.drawVideoTile(ctx, video, p.name, p.isMuted, x, y, tileW, tileH);
          });
        }

        // Live Recording Overlay Watermark
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.roundRect(w - 280, 24, 256, 36, [8]);
        ctx.fill();

        ctx.fillStyle = Math.floor(Date.now() / 600) % 2 === 0 ? '#ef4444' : '#f87171';
        ctx.beginPath();
        ctx.arc(w - 262, 42, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        const elapsedSec = Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        ctx.fillText(`REC ${mins}:${secs} • Majlis`, w - 246, 46);

        this.canvasAnimFrame = requestAnimationFrame(drawMeetingComposite);
      };

      drawMeetingComposite();

      const canvasStream = this.canvas.captureStream(30);

      const audioStreamsToMix: MediaStream[] = [];
      if (this.options.localStream) audioStreamsToMix.push(this.options.localStream);
      this.options.remoteStreams.forEach((s) => audioStreamsToMix.push(s));

      const { mixedStream, cleanup } = createMixedAudioStream(audioStreamsToMix);
      this.audioCleanup = cleanup;

      recordingStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((t) => recordingStream.addTrack(t));
      mixedStream.getAudioTracks().forEach((t) => recordingStream.addTrack(t));
    }

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    this.mediaRecorder = new MediaRecorder(
      recordingStream,
      selectedMimeType ? { mimeType: selectedMimeType } : undefined
    );

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.currentSizeBytes += event.data.size;
        if (this.options.onTick) {
          const currentDuration = Math.max(
            0,
            Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000)
          );
          this.options.onTick(currentDuration, this.currentSizeBytes);
        }
      }
    };

    this.mediaRecorder.start(1000);
    this.status = 'recording';
    this.options.onStatusChange?.('recording');

    this.timerInterval = window.setInterval(() => {
      if (this.status === 'recording' && this.options.onTick) {
        const currentDuration = Math.max(
          0,
          Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000)
        );
        this.options.onTick(currentDuration, this.currentSizeBytes);
      }
    }, 1000);
  }

  private drawAvatarPlaceholder(
    ctx: CanvasRenderingContext2D,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#075E4A');
    grad.addColorStop(1, '#174A83');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    const initial = (name || 'M').charAt(0).toUpperCase();
    ctx.fillStyle = 'rgba(233, 168, 58, 0.25)';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2 - 12, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFCF5';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, x + w / 2, y + h / 2 - 12);
  }

  private drawVideoTile(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement | null,
    name: string,
    isMuted: boolean,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [12]);
    ctx.clip();

    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const vW = video.videoWidth;
        const vH = video.videoHeight;
        const videoRatio = vW / vH;
        const targetRatio = w / h;

        let renderW = w;
        let renderH = h;
        let offsetX = x;
        let offsetY = y;

        if (videoRatio > targetRatio) {
          renderW = h * videoRatio;
          offsetX = x - (renderW - w) / 2;
        } else {
          renderH = w / videoRatio;
          offsetY = y - (renderH - h) / 2;
        }

        ctx.drawImage(video, offsetX, offsetY, renderW, renderH);
      } catch {
        this.drawAvatarPlaceholder(ctx, name, x, y, w, h);
      }
    } else {
      this.drawAvatarPlaceholder(ctx, name, x, y, w, h);
    }

    // Bottom name badge gradient
    const badgeH = 34;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(x + 12, y + h - badgeH - 12, Math.min(220, w - 24), badgeH);

    ctx.fillStyle = '#ffffff';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = `${name}${isMuted ? ' 🔇' : ''}`;
    ctx.fillText(label, x + 24, y + h - 12 - badgeH / 2);

    ctx.restore();
  }

  public pause(): void {
    if (this.mediaRecorder && this.status === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      this.status = 'paused';
      this.options.onStatusChange?.('paused');
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.status === 'paused') {
      this.mediaRecorder.resume();
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.status = 'recording';
      this.options.onStatusChange?.('recording');
    }
  }

  public stop(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      this.status = 'stopped';
      this.options.onStatusChange?.('stopped');

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.canvasAnimFrame) {
        cancelAnimationFrame(this.canvasAnimFrame);
        this.canvasAnimFrame = null;
      }
      if (this.audioCleanup) {
        this.audioCleanup();
        this.audioCleanup = null;
      }
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;
      }

      this.internalVideos.forEach((v) => {
        v.srcObject = null;
      });
      this.internalVideos.clear();

      if (!this.mediaRecorder) {
        resolve({
          blob: new Blob([], { type: 'video/webm' }),
          url: '',
          durationSeconds: 0,
          sizeBytes: 0,
          createdAt: Date.now(),
          fileName: `majlis_${this.options.roomId}.webm`,
        });
        return;
      }

      const finish = () => {
        const finalType = this.mediaRecorder?.mimeType || 'video/webm';
        const finalBlob = new Blob(this.recordedChunks, { type: finalType });
        const finalUrl = URL.createObjectURL(finalBlob);
        const finalDuration = Math.max(
          1,
          Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000)
        );

        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = finalType.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `majlis_${this.options.roomId}_${dateStr}.${ext}`;

        resolve({
          blob: finalBlob,
          url: finalUrl,
          durationSeconds: finalDuration,
          sizeBytes: finalBlob.size,
          createdAt: Date.now(),
          fileName,
        });
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = finish;
        this.mediaRecorder.stop();
      } else {
        finish();
      }
    });
  }

  public static downloadFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }
}
