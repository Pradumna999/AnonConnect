/**
 * WebRTC Peer-to-Peer Media Controller
 * Zero media through Firebase. All video/audio passes directly peer-to-peer.
 */

export interface WebRTCConfig {
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (err: string) => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isClosed = false;

  constructor(private config: WebRTCConfig) {}

  /**
   * Acquire local camera and microphone stream
   */
  public async startMedia(video = true, audio = true): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 24, max: 30 },
            }
          : false,
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });

      this.localStream = stream;
      this.config.onLocalStream(stream);
      return stream;
    } catch (err: any) {
      const errorMsg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera/microphone access was denied. Please allow permissions in your browser.'
          : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
          ? 'No camera or microphone found on your device.'
          : `Media capture error: ${err.message || 'Unknown error'}`;
      this.config.onError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Initialize Peer Connection with STUN/TURN
   */
  public initPeerConnection(role: 'caller' | 'callee') {
    this.cleanupPeerConnection();
    this.isClosed = false;
    this.pendingCandidates = [];

    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Optional TURN configuration from environment if present
    const turnUrl = (window as any)?.__ENV?.TURN_SERVER_URL;
    const turnUsername = (window as any)?.__ENV?.TURN_USERNAME;
    const turnCredential = (window as any)?.__ENV?.TURN_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    this.pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 2,
    });

    // Remote stream tracks
    this.remoteStream = new MediaStream();
    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      if (this.remoteStream) {
        this.config.onRemoteStream(this.remoteStream);
      }
    };

    // Attach local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    }

    // ICE Candidate generation
    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.isClosed) {
        this.config.onIceCandidate(event.candidate.toJSON());
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (!this.pc || this.isClosed) return;
      this.config.onConnectionStateChange(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc || this.isClosed) return;
      if (this.pc.iceConnectionState === 'failed') {
        this.config.onError('WebRTC direct connection failed. Try skipping or checking firewall settings.');
      }
    };
  }

  /**
   * Caller generates SDP Offer
   */
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Callee processes SDP Offer and creates SDP Answer
   */
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.processPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Caller receives SDP Answer
   */
  public async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.processPendingCandidates();
  }

  /**
   * Process incoming trickle ICE Candidate
   */
  public async addIceCandidate(candidateInit: RTCIceCandidateInit) {
    if (!this.pc || this.isClosed) return;

    if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      // Buffer until remote description is set
      this.pendingCandidates.push(candidateInit);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (err) {
      console.warn('[WebRTC] Error adding candidate:', err);
    }
  }

  private async processPendingCandidates() {
    if (!this.pc) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Error adding buffered candidate:', err);
        }
      }
    }
  }

  /**
   * Toggle Audio Mute
   */
  public toggleAudio(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle Video Camera
   */
  public toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Clean up Peer Connection only (keeps media stream alive for next stranger)
   */
  public cleanupPeerConnection() {
    this.isClosed = true;
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];
  }

  /**
   * Full cleanup: release camera, mic, and connection
   */
  public destroy() {
    this.cleanupPeerConnection();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
  }
}
