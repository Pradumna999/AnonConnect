import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Maximize, User } from 'lucide-react';

interface VideoViewProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  partnerNickname: string;
  connectionState: RTCPeerConnectionState;
  onToggleAudio: () => boolean;
  onToggleVideo: () => boolean;
}

export const VideoView: React.FC<VideoViewProps> = ({
  localStream,
  remoteStream,
  partnerNickname,
  connectionState,
  onToggleAudio,
  onToggleVideo,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleToggleAudio = () => {
    const isEnabled = onToggleAudio();
    setIsAudioMuted(!isEnabled);
  };

  const handleToggleVideo = () => {
    const isEnabled = onToggleVideo();
    setIsVideoDisabled(!isEnabled);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const hasRemoteVideoTrack = Boolean(
    remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between select-none shadow-md"
    >
      {/* Remote Video Surface */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-950">
        {hasRemoteVideoTrack ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-inner">
              <User className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">
                {partnerNickname || 'Stranger'}
              </p>
              <p className="text-xs text-zinc-400">
                {connectionState === 'connected'
                  ? 'Connected · Camera starting up...'
                  : connectionState === 'connecting'
                  ? 'Connecting video call...'
                  : 'Waiting for partner...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Overlay Badge */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/75 backdrop-blur-md border border-white/10 text-xs shadow-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connectionState === 'connected'
                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                : connectionState === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-zinc-500'
            }`}
          />
          <span className="font-semibold text-white">
            {partnerNickname || 'Stranger'}
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300 capitalize">
            {connectionState === 'connected' ? 'Live' : connectionState}
          </span>
        </div>

        <button
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="p-2 rounded-xl bg-zinc-950/75 backdrop-blur-md border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer shadow-sm"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Bar & Picture-in-Picture Local Camera */}
      <div className="relative z-10 p-3 sm:p-4 flex items-end justify-between">
        {/* Floating Controls Bar */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-xl">
          <button
            onClick={handleToggleAudio}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isAudioMuted
                ? 'bg-red-500 text-white'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleToggleVideo}
            title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isVideoDisabled
                ? 'bg-red-500 text-white'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>

        {/* Local Preview Tile */}
        <div className="relative w-28 sm:w-36 aspect-4/3 rounded-2xl overflow-hidden border-2 border-emerald-500/60 bg-zinc-900 shadow-2xl">
          {isVideoDisabled ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 text-[10px]">
              <VideoOff className="w-5 h-5 mb-1 text-zinc-500" />
              <span>Camera Off</span>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}
          <div className="absolute bottom-1.5 left-2 text-[10px] text-white font-semibold bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
            You
          </div>
        </div>
      </div>
    </div>
  );
};
