import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { socket } from '../../services/socket';
import { VideoCallModal } from '../video/VideoCallModal';
import { Phone, PhoneOff, Video } from 'lucide-react';
import toast from 'react-hot-toast';

interface IncomingCallData {
  offer: any;
  from: string;
  name: string;
}

export const DashboardLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [activeCall, setActiveCall] = useState<{
    roomId: string;
    targetName: string;
    incomingOffer: IncomingCallData;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const handleIncomingCall = (data: IncomingCallData) => {
      console.log('Global socket listener: Incoming call from', data.name);
      setIncomingCall(data);
      toast(`Incoming pitch call from ${data.name}!`, { icon: '📞', duration: 8000 });
    };

    socket.on('incoming-call', handleIncomingCall);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
    };
  }, [isAuthenticated, user]);

  const handleAcceptCall = () => {
    if (incomingCall) {
      setActiveCall({
        roomId: `meeting_${Date.now()}`,
        targetName: incomingCall.name,
        incomingOffer: incomingCall,
      });
      setIncomingCall(null);
    }
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      socket.emit('end-call', { to: incomingCall.from });
      setIncomingCall(null);
      toast.error('Call declined');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      <Navbar />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Ringing overlay panel */}
      {incomingCall && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white rounded-xl shadow-2xl p-4 border border-gray-800 flex items-center gap-4 animate-bounce max-w-sm">
          <div className="p-3 bg-success-500/20 rounded-full text-success-400">
            <Phone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Incoming Pitch Call</h4>
            <p className="text-xs text-gray-400 truncate max-w-[150px]">{incomingCall.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptCall}
              className="px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white text-xs font-semibold rounded-md flex items-center gap-1 transition"
            >
              <Video className="w-3.5 h-3.5" /> Accept
            </button>
            <button
              onClick={handleDeclineCall}
              className="px-3 py-1.5 bg-error-600 hover:bg-error-700 text-white text-xs font-semibold rounded-md flex items-center gap-1 transition"
            >
              <PhoneOff className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        </div>
      )}

      {/* Active Call Modal (Callee mode) */}
      {activeCall && (
        <VideoCallModal
          roomId={activeCall.roomId}
          targetName={activeCall.targetName}
          incomingOffer={activeCall.incomingOffer}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
};