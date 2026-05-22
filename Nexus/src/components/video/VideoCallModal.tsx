import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface VideoCallModalProps {
  roomId: string;
  targetName: string;
  targetUserId?: string; // If caller, we pass targetUserId
  incomingOffer?: any;   // If callee, we pass incomingOffer
  onClose: () => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  roomId,
  targetName,
  targetUserId,
  incomingOffer,
  onClose,
}) => {
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'calling' | 'connected' | 'ended' | 'failed'>('connecting');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    let active = true;

    const initCall = async () => {
      try {
        // 1. Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Initialize RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        });
        peerConnectionRef.current = pc;

        // 3. Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 4. Handle remote stream tracking
        pc.ontrack = (event) => {
          console.log('WebRTC: Remote track received', event.streams);
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
            }
            setCallStatus('connected');
          }
        };

        // 5. Handle ICE candidates generated locally
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const recipientId = targetUserId || (incomingOffer ? incomingOffer.from : null);
            if (recipientId) {
              console.log('WebRTC: Sending ICE candidate to', recipientId);
              socket.emit('ice-candidate', {
                candidate: event.candidate,
                to: recipientId,
              });
            }
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('WebRTC: Connection state changed:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setCallStatus('connected');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
            setCallStatus('ended');
            toast.error('Call disconnected');
            handleHangUp();
          } else if (pc.connectionState === 'failed') {
            setCallStatus('failed');
            toast.error('WebRTC negotiation failed');
          }
        };

        // 6. Handle signaling based on role
        if (incomingOffer) {
          // Callee Mode: answer incoming call
          console.log('WebRTC: Setting remote description (offer)', incomingOffer.offer);
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
          
          // Process queued ICE candidates
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }

          console.log('WebRTC: Creating answer');
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('answer-call', {
            answer,
            to: incomingOffer.from,
          });
          setCallStatus('connected');
        } else if (targetUserId) {
          // Caller Mode: initiate call
          setCallStatus('calling');
          console.log('WebRTC: Creating offer for', targetUserId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('call-user', {
            offer,
            to: targetUserId,
            from: user?.id,
            name: user?.name || 'User',
          });
        }
      } catch (err: any) {
        console.error('WebRTC: Error setting up call:', err);
        toast.error('Failed to access camera or microphone');
        onClose();
      }
    };

    initCall();

    // 7. Set up socket signaling listeners for this active call
    const handleCallAccepted = async (data: { answer: any }) => {
      console.log('WebRTC: Call accepted, setting remote description (answer)');
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallStatus('connected');
          
          // Process queued ICE candidates
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            if (cand) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
        }
      } catch (err) {
        console.error('WebRTC: Error setting remote description (answer):', err);
      }
    };

    const handleIceCandidate = async (data: { candidate: any }) => {
      console.log('WebRTC: Received remote ICE candidate');
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          // Queue candidates if remote desc not set yet
          pendingCandidatesRef.current.push(data.candidate);
        }
      } catch (err) {
        console.error('WebRTC: Error adding remote ICE candidate:', err);
      }
    };

    const handleCallEnded = () => {
      console.log('WebRTC: Call ended by peer');
      toast('Call ended by peer');
      setCallStatus('ended');
      setTimeout(() => {
        onClose();
      }, 1000);
    };

    socket.on('call-accepted', handleCallAccepted);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-ended', handleCallEnded);

    return () => {
      active = false;
      socket.off('call-accepted', handleCallAccepted);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-ended', handleCallEnded);
      
      // Clean up streams & peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, targetUserId, incomingOffer, user]);

  const handleHangUp = () => {
    const recipientId = targetUserId || (incomingOffer ? incomingOffer.from : null);
    if (recipientId) {
      socket.emit('end-call', { to: recipientId });
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    setCallStatus('ended');
    toast.success('Call ended');
    onClose();
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="flex justify-between items-center text-white bg-gray-900/50 backdrop-blur px-6 py-4 rounded-xl">
        <div>
          <h2 className="text-xl font-bold">{targetName}</h2>
          <p className="text-sm text-gray-400">
            {callStatus === 'calling' && 'Calling... Wait for response'}
            {callStatus === 'connecting' && 'Setting up connection...'}
            {callStatus === 'connected' && 'In Call (Secure WebRTC)'}
            {callStatus === 'ended' && 'Call ended'}
            {callStatus === 'failed' && 'Connection failed'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-primary-400 bg-primary-950/40 border border-primary-800 px-3 py-1.5 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse"></span>
          Room: {roomId.slice(-6)}
        </div>
      </div>

      {/* Videos Section */}
      <div className="flex-1 my-6 relative overflow-hidden rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
        {/* Remote Video (Main background view) */}
        {remoteStream && callStatus === 'connected' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center text-gray-400 p-8 space-y-4">
            <div className="w-20 h-20 mx-auto bg-gray-800 rounded-full flex items-center justify-center animate-pulse">
              <Video className="w-10 h-10 text-gray-600" />
            </div>
            <p className="font-semibold text-lg">Connecting with {targetName}...</p>
            <p className="text-xs text-gray-500 max-w-sm">
              Please grant camera/microphone permissions if prompted. Peer negotiation begins once the remote user accepts.
            </p>
          </div>
        )}

        {/* Local Video (Floating overlay) */}
        <div className="absolute bottom-4 right-4 w-40 md:w-56 aspect-[3/4] bg-gray-950 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
          {localStream && !isCameraOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-900 text-xs">
              <VideoOff className="w-6 h-6 mb-1" />
              <span>Camera Off</span>
            </div>
          )}
          <div className="absolute top-2 left-2 text-[10px] bg-black/60 px-2 py-0.5 rounded text-white font-medium">
            You
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex justify-center items-center gap-6 py-4 bg-gray-900/40 backdrop-blur rounded-2xl border border-gray-850 px-8">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full border transition-all duration-200 ${
            isMuted
              ? 'bg-error-500/25 border-error-500 text-error-400 hover:bg-error-500/35'
              : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleCamera}
          className={`p-4 rounded-full border transition-all duration-200 ${
            isCameraOff
              ? 'bg-error-500/25 border-error-500 text-error-400 hover:bg-error-500/35'
              : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
          }`}
          title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        <button
          onClick={handleHangUp}
          className="p-4 rounded-full bg-error-600 hover:bg-error-700 text-white border border-error-500 shadow-lg shadow-error-600/20 hover:scale-105 active:scale-95 transition-all duration-200"
          title="End Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
