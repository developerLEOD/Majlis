import { RecordingResult } from '../types/meeting';
import { createMixedAudioStream } from '../utils/media';

export type RecordingMode = 'composite' | 'screen';

export interface RecorderOptions {
  roomId: string;
  mode: RecordingMode;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  getParticipants: () => { id: string; name: string; isMuted: boolean; isVideoOff: boolean; stream?: MediaStream; isScreenSharing?: boolean }[];
  getVideoElements: () => { id: string; name: string; element: HTMLVideoElement | null; isMuted: boolean }[];
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
  private canvasRenderInterval: number | null = null;
  private timerWorker: Worker | null = null;
  private audioSyncInterval: number | null = null;
  private screenStream: MediaStream | null = null;
  private audioCleanup: (() => void) | null = null;
  private options: RecorderOptions;
  private canvas: HTMLCanvasElement | null = null;
  private currentSizeBytes = 0;
  private internalVideos: Map<string, HTMLVideoElement> = new Map();

  // Dynamic Audio Mixing context & nodes
  private audioCtx: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private connectedSources: Map<string, { source: MediaStreamAudioSourceNode; track: MediaStreamTrack }> = new Map();

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
      // Initialize dynamic AudioContext with forced 48kHz sample rate to prevent clock drift and audio quality deterioration over time
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({
        latencyHint: 'playback',
        sampleRate: 48000,
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      this.audioDestination = this.audioCtx.createMediaStreamDestination();
      this.connectedSources.clear();

      // Ensure an active DOM container exists to force the browser to decode and keep video elements active.
      // Must have visible dimensions (320x240) and opacity > 0 (0.001) in viewport so Chromium never halts or suspends the decoder pipeline.
      let videoContainer = document.getElementById('recording-video-container');
      if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = 'recording-video-container';
        videoContainer.setAttribute(
          'style',
          'position: fixed; bottom: 0; right: 0; width: 320px; height: 240px; overflow: hidden; pointer-events: none; opacity: 0.001; z-index: -9999;'
        );
        document.body.appendChild(videoContainer);
      }

      const createInternalVideo = (stream: MediaStream) => {
        const v = document.createElement('video');
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        v.style.width = '320px';
        v.style.height = '240px';
        v.style.display = 'block';
        videoContainer!.appendChild(v);
        v.play().catch(() => {});
        return v;
      };

      // Initialize internal video elements for each participant stream currently active
      this.internalVideos.clear();
      const currentParticipants = this.options.getParticipants();
      currentParticipants.forEach((p) => {
        if (p.stream && p.stream.getVideoTracks().length > 0) {
          const v = createInternalVideo(p.stream);
          this.internalVideos.set(p.id, v);
        }
      });

      // Synchronize dynamic audio mixer tracks and video elements decoupled from the 30 FPS render loop
      const syncTracks = () => {
        if (this.status !== 'recording' || !this.audioCtx || !this.audioDestination) return;
        const participants = this.options.getParticipants();
        const activeTrackKeys = new Set<string>();

        participants.forEach((p) => {
          if (p.stream && p.stream.getVideoTracks().length > 0 && !this.internalVideos.has(p.id)) {
            const v = createInternalVideo(p.stream);
            this.internalVideos.set(p.id, v);
          }

          if (p.stream) {
            const audioTracks = p.stream.getAudioTracks().filter((t) => t.enabled && t.readyState === 'live');
            audioTracks.forEach((track) => {
              const trackKey = `${p.id}_${track.id}`;
              activeTrackKeys.add(trackKey);

              const existing = this.connectedSources.get(trackKey);
              if (!existing) {
                try {
                  const singleTrackStream = new MediaStream([track]);
                  const source = this.audioCtx!.createMediaStreamSource(singleTrackStream);
                  source.connect(this.audioDestination!);
                  this.connectedSources.set(trackKey, { source, track });
                } catch (err) {
                  console.warn('Could not attach individual audio track in recorder:', err);
                }
              }
            });
          }
        });

        this.connectedSources.forEach((conn, key) => {
          if (!activeTrackKeys.has(key) || conn.track.readyState === 'ended' || !conn.track.enabled) {
            try {
              conn.source.disconnect();
            } catch {}
            this.connectedSources.delete(key);
          }
        });
      };

      syncTracks();
      this.audioSyncInterval = window.setInterval(syncTracks, 1000);

      // 720p HD (1280x720) canvas: optimal resolution providing crisp text and graphics while consuming 55% less bandwidth
      // than 1080p, allowing both hardware and software encoders to maintain steady 30 FPS without dropping frames.
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      const ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true })!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      const drawMeetingComposite = () => {
        if (this.status === 'stopped' || this.status === 'paused') return;

        const w = this.canvas!.width;
        const h = this.canvas!.height;

        ctx.fillStyle = '#06080d';
        ctx.fillRect(0, 0, w, h);

        const participantsList = this.options.getParticipants();
        const domElements = this.options.getVideoElements();
        const domMap = new Map(domElements.map((e) => [e.id, e.element]));

        const getVideoForParticipant = (pId: string, isVideoOff: boolean) => {
          if (isVideoOff) return null;
          const domEl = domMap.get(pId);
          if (domEl) return domEl;
          return this.internalVideos.get(pId) || null;
        };

        const screenSharer = participantsList.find((p) => p.isScreenSharing);

        if (screenSharer) {
          const screenVideo = getVideoForParticipant(screenSharer.id, screenSharer.isVideoOff);
          this.drawSharedScreen(ctx, screenVideo, screenSharer.name, w, h);
        } else {
          const count = participantsList.length;

          if (count === 0) {
            ctx.fillStyle = '#101625';
            ctx.fillRect(40, 40, w - 80, h - 80);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '24px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Majlis Session in Progress', w / 2, h / 2);
          } else if (count === 1) {
            const p = participantsList[0];
            const video = getVideoForParticipant(p.id, p.isVideoOff);
            this.drawVideoTile(ctx, video, p.name, p.isMuted, 20, 20, w - 40, h - 40);
          } else if (count === 2) {
            const tileW = (w - 60) / 2;
            const tileH = h - 60;
            const p0 = participantsList[0];
            const p1 = participantsList[1];
            this.drawVideoTile(
              ctx,
              getVideoForParticipant(p0.id, p0.isVideoOff),
              p0.name,
              p0.isMuted,
              20,
              30,
              tileW,
              tileH
            );
            this.drawVideoTile(
              ctx,
              getVideoForParticipant(p1.id, p1.isVideoOff),
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
              const video = getVideoForParticipant(p.id, p.isVideoOff);
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
              const video = getVideoForParticipant(p.id, p.isVideoOff);
              this.drawVideoTile(ctx, video, p.name, p.isMuted, x, y, tileW, tileH);
            });
          }
        }
      };

      // Unthrottled Web Worker timer:
      // Browsers aggressively throttle requestAnimationFrame and window.setInterval to 0-1 FPS
      // when the user is sharing another window or viewing another tab.
      // Web Workers run in a background thread and are never throttled, ensuring steady 30 FPS encoding.
      const workerScript = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 33.33);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `;

      try {
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.timerWorker = new Worker(workerUrl);
        this.timerWorker.onmessage = () => {
          drawMeetingComposite();
        };
        this.timerWorker.postMessage('start');
      } catch (e) {
        console.warn('Web Worker timer unavailable, falling back to interval:', e);
        this.canvasRenderInterval = window.setInterval(drawMeetingComposite, 33);
      }

      const canvasStream = this.canvas.captureStream(30);

      recordingStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((t) => recordingStream.addTrack(t));
      this.audioDestination.stream.getAudioTracks().forEach((t) => recordingStream.addTrack(t));
    }

    // Evaluate hardware-accelerated MP4 MIME type first, falling back to WebM
    const candidateMimeTypes = [
      'video/mp4;codecs=avc1.424028,mp4a.40.2',
      'video/mp4;codecs=avc1.4d401f,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
    ];

    let selectedMimeType = '';
    if (typeof MediaRecorder !== 'undefined') {
      for (const type of candidateMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.info(`[LocalMeetingRecorder] Selected hardware/supported MIME type: ${type}`);
          break;
        }
      }
    }

    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: 2500000, // Consistent 2.5 Mbps constant bitrate for smooth chunk encoding without frame skipping
      audioBitsPerSecond: 128000,  // Consistent 128 kbps audio
    };
    if (selectedMimeType) {
      recorderOptions.mimeType = selectedMimeType;
    }

    this.mediaRecorder = new MediaRecorder(recordingStream, recorderOptions);

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

    // Use 2000ms timeSlice: balances steady keyframe pacing with regular cluster emission, preventing frame skip
    this.mediaRecorder.start(2000);
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

  private drawSharedScreen(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement | null,
    name: string,
    w: number,
    h: number
  ) {
    // Fill canvas background with clean solid black for letterbox/pillarbox margins
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    let drewVideo = false;

    if (video && (video.readyState >= 2 || video.videoWidth > 0)) {
      try {
        const vW = video.videoWidth;
        const vH = video.videoHeight;

        if (vW > 0 && vH > 0) {
          const videoRatio = vW / vH;
          const canvasRatio = w / h;

          let drawW = w;
          let drawH = h;
          let drawX = 0;
          let drawY = 0;

          // Standard contain math: strictly preserve 100% exact original aspect ratio without distortion or cropping
          if (videoRatio > canvasRatio) {
            // Shared screen is wider than canvas ratio -> fit width, letterbox top/bottom
            drawW = w;
            drawH = w / videoRatio;
            drawX = 0;
            drawY = (h - drawH) / 2;
          } else {
            // Shared screen is taller than canvas ratio -> fit height, pillarbox left/right
            drawH = h;
            drawW = h * videoRatio;
            drawX = (w - drawW) / 2;
            drawY = 0;
          }

          // Render clean edge-to-edge shared screen: no borders, no clipping, no side panel, and no obscuring badge labels
          ctx.drawImage(
            video,
            Math.round(drawX),
            Math.round(drawY),
            Math.round(drawW),
            Math.round(drawH)
          );
          drewVideo = true;
        }
      } catch (err) {
        // Fallback below if frame cannot be decoded yet
      }
    }

    if (!drewVideo) {
      // Clean fallback if screen video stream is loading
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${name}'s Screen Share`, w / 2, h / 2);
    }
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

    let drewVideo = false;

    if (video) {
      try {
        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;
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
        drewVideo = true;
      } catch (err) {
        // Fallback to avatar if drawImage fails
      }
    }

    if (!drewVideo) {
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
      try { this.timerWorker?.postMessage('stop'); } catch {}
      this.options.onStatusChange?.('paused');
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.status === 'paused') {
      this.mediaRecorder.resume();
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.status = 'recording';
      try { this.timerWorker?.postMessage('start'); } catch {}
      this.options.onStatusChange?.('recording');
    }
  }

  public stop(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      this.status = 'stopped';
      this.options.onStatusChange?.('stopped');

      if (this.audioSyncInterval) {
        clearInterval(this.audioSyncInterval);
        this.audioSyncInterval = null;
      }
      if (this.timerWorker) {
        try {
          this.timerWorker.postMessage('stop');
          this.timerWorker.terminate();
        } catch {}
        this.timerWorker = null;
      }
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.canvasAnimFrame) {
        cancelAnimationFrame(this.canvasAnimFrame);
        this.canvasAnimFrame = null;
      }
      if (this.canvasRenderInterval) {
        clearInterval(this.canvasRenderInterval);
        this.canvasRenderInterval = null;
      }
      if (this.audioCleanup) {
        this.audioCleanup();
        this.audioCleanup = null;
      }
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;
      }

      const videoContainer = document.getElementById('recording-video-container');
      if (videoContainer) {
        videoContainer.remove();
      }

      this.internalVideos.forEach((v) => {
        v.srcObject = null;
      });
      this.internalVideos.clear();

      this.connectedSources.forEach((conn) => {
        try { conn.source.disconnect(); } catch {}
      });
      this.connectedSources.clear();

      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
      this.audioDestination = null;

      if (!this.mediaRecorder) {
        resolve({
          blob: new Blob([], { type: 'video/mp4' }),
          url: '',
          durationSeconds: 0,
          sizeBytes: 0,
          createdAt: Date.now(),
          fileName: `majlis_${this.options.roomId}.mp4`,
        });
        return;
      }

      const finish = () => {
        const finalType = this.mediaRecorder?.mimeType || 'video/mp4';
        const finalBlob = new Blob(this.recordedChunks, { type: finalType });
        const finalUrl = URL.createObjectURL(finalBlob);
        const finalDuration = Math.max(
          1,
          Math.floor((Date.now() - this.startTime - this.pausedDuration) / 1000)
        );

        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = finalType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
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
