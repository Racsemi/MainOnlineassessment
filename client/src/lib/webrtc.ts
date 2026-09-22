const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onSignalCallback?: (signal: any) => void;
  private targetSocketId: string = '';

  constructor(
    targetSocketId: string,
    onRemoteStream?: (stream: MediaStream) => void,
    onSignal?: (signal: any) => void
  ) {
    this.targetSocketId = targetSocketId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onSignalCallback = onSignal;
  }

  async getLocalMedia(video = true, audio = true): Promise<MediaStream | null> {
    try {
      if (this.localStream) {
        this.toggleVideo(video);
        this.toggleAudio(audio);
        return this.localStream;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      this.localStream = stream;
      
      // Apply initial mute/cam-off states
      stream.getVideoTracks().forEach((track) => {
        track.enabled = video;
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = audio;
      });

      return stream;
    } catch (err) {
      console.warn('[WebRTC] getUserMedia with video failed, falling back to audio only:', err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.localStream = audioStream;
        return audioStream;
      } catch (audioErr) {
        console.warn('[WebRTC] audio getUserMedia also denied:', audioErr);
        return null;
      }
    }
  }


  initPeerConnection(isInitiator: boolean): RTCPeerConnection {
    if (this.pc) {
      this.pc.close();
    }

    this.pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks if stream exists
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming remote tracks
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onRemoteStreamCallback?.(event.streams[0]);
      }
    };

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.onSignalCallback) {
        this.onSignalCallback({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    // If initiator, create and send Offer
    if (isInitiator) {
      this.createOffer();
    }

    return this.pc;
  }

  async createOffer(): Promise<void> {
    if (!this.pc) return;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.onSignalCallback?.({
        type: 'offer',
        sdp: this.pc.localDescription,
      });
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
    }
  }

  async handleSignal(signalData: any): Promise<void> {
    if (!this.pc) {
      this.initPeerConnection(false);
    }

    try {
      if (signalData.type === 'offer') {
        await this.pc?.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await this.pc?.createAnswer();
        if (answer) {
          await this.pc?.setLocalDescription(answer);
          this.onSignalCallback?.({
            type: 'answer',
            sdp: this.pc?.localDescription,
          });
        }

      } else if (signalData.type === 'answer') {
        await this.pc?.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        await this.pc?.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      console.error('[WebRTC] Error handling signal:', err);
    }
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.screenStream = stream;

      const screenTrack = stream.getVideoTracks()[0];
      if (this.pc && screenTrack) {
        const senders = this.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      }

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return stream;
    } catch (err) {
      console.warn('[WebRTC] Screen share cancelled or denied:', err);
      return null;
    }
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    if (this.localStream && this.pc) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      if (cameraTrack) {
        const senders = this.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      }
    }
  }

  destroy(): void {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}
