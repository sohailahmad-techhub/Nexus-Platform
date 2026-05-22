import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Bell, Calendar, CircleDollarSign, PlusCircle, AlertCircle, RefreshCw, MessageSquare, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

interface BackendUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'entrepreneur' | 'investor';
  startupName?: string;
  industry?: string;
  bio?: string;
}

interface Meeting {
  id: string;
  hostId: BackendUser;
  inviteeId: BackendUser;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
}

export const EntrepreneurDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [investors, setInvestors] = useState<BackendUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [meetingsRes, usersRes] = await Promise.all([
        api.get('/meetings'),
        api.get('/auth/users')
      ]);
      setMeetings(meetingsRes.data);
      // Filter out all investors
      const list = usersRes.data.filter((u: BackendUser) => u.role === 'investor');
      setInvestors(list);
    } catch (err: any) {
      console.error('Dashboard loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const handleAcceptInvite = async (meetingId: string) => {
    try {
      await api.post(`/meetings/accept/${meetingId}`);
      toast.success('Pitch invitation accepted');
      fetchDashboardData();
    } catch (err: any) {
      toast.error('Failed to accept invitation');
    }
  };

  const handleDeclineInvite = async (meetingId: string) => {
    try {
      await api.post(`/meetings/reject/${meetingId}`);
      toast.success('Pitch invitation declined');
      fetchDashboardData();
    } catch (err: any) {
      toast.error('Failed to decline invitation');
    }
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const now = new Date();

  // Metrics
  const pendingRequests = meetings.filter(
    m => m.status === 'pending' && m.inviteeId.id === user.id && new Date(m.startTime) > now
  );

  const totalConnectionsCount = Array.from(new Set(
    meetings.filter(m => m.status === 'accepted')
      .map(m => m.hostId.id === user.id ? m.inviteeId.id : m.hostId.id)
  )).length;

  const upcomingMeetings = meetings.filter(
    m => m.status === 'accepted' && new Date(m.startTime) > now
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Welcome, {user.name}</h1>
          <p className="text-gray-600">Here's your startup's pitch status and active partners</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={fetchDashboardData}
            className="p-2 border border-gray-300 rounded-md hover:bg-gray-100 transition text-gray-500 hover:text-gray-700"
            title="Refresh Dashboard"
          >
            <RefreshCw size={18} />
          </button>
          <Link to="/investors">
            <Button leftIcon={<PlusCircle size={18} />}>
              Find Investors
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary-50 border border-primary-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-full mr-4 text-primary-700">
                <Bell size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Pending Pitches</p>
                <h3 className="text-2xl font-bold text-primary-950 mt-0.5">{pendingRequests.length}</h3>
              </div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="bg-secondary-50 border border-secondary-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-secondary-100 rounded-full mr-4 text-secondary-700">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">Total Partners</p>
                <h3 className="text-2xl font-bold text-secondary-950 mt-0.5">{totalConnectionsCount}</h3>
              </div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="bg-accent-50 border border-accent-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-accent-100 rounded-full mr-4 text-accent-700">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-accent-700 uppercase tracking-wider">Upcoming Calls</p>
                <h3 className="text-2xl font-bold text-accent-950 mt-0.5">{upcomingMeetings.length}</h3>
              </div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="bg-success-50 border border-success-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-success-100 rounded-full mr-4 text-success-700">
                <CircleDollarSign size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-success-700 uppercase tracking-wider">Wallet Balance</p>
                <h3 className="text-2xl font-bold text-success-950 mt-0.5">
                  ${(user.walletBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </h3>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Collaboration Requests */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900">Pitch Invitations</h2>
              <Badge variant="primary">{pendingRequests.length} pending</Badge>
            </CardHeader>
            
            <CardBody className="pt-4">
              {pendingRequests.length > 0 ? (
                <div className="space-y-4">
                  {pendingRequests.map(meeting => (
                    <div key={meeting.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Avatar src={meeting.hostId.avatarUrl} alt={meeting.hostId.name} size="md" />
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm md:text-base">{meeting.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">Requested by {meeting.hostId.name} ({meeting.hostId.email})</p>
                          <p className="text-xs text-gray-700 mt-2 italic bg-gray-50 p-2 rounded border border-gray-100">
                            "{meeting.description || 'No description provided.'}"
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">
                              {new Date(meeting.startTime).toLocaleDateString()}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-stretch justify-center gap-2 shrink-0">
                        <button
                          onClick={() => handleAcceptInvite(meeting.id)}
                          className="px-3 py-2 bg-success-600 hover:bg-success-700 text-white font-bold text-xs rounded-md flex items-center justify-center gap-1 transition"
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(meeting.id)}
                          className="px-3 py-2 bg-transparent hover:bg-error-50 text-error-600 border border-error-200 hover:border-error-300 font-bold text-xs rounded-md flex items-center justify-center gap-1 transition"
                        >
                          <X size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-3">
                    <AlertCircle size={20} />
                  </div>
                  <p className="text-sm font-medium text-gray-700">No pending invitations</p>
                  <p className="text-xs text-gray-500 mt-1">When investors schedule pitches, they will display here.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        
        {/* Right: Recommended Investors list */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900">Recommended Investors</h2>
              <Link to="/investors" className="text-xs font-semibold text-primary-600 hover:underline">
                View all
              </Link>
            </CardHeader>
            
            <CardBody className="pt-4">
              {investors.length > 0 ? (
                <div className="space-y-3">
                  {investors.slice(0, 4).map(investor => (
                    <div 
                      key={investor.id} 
                      className="flex items-center justify-between p-3 border border-gray-150 rounded-xl hover:border-primary-100 transition bg-white"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={investor.avatarUrl} alt={investor.name} size="sm" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 text-xs md:text-sm truncate">{investor.name}</h4>
                          <p className="text-[10px] text-gray-500 truncate">{investor.industry || 'Venture Capital'}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => navigate(`/chat/${investor.id}`)}
                        className="p-2 hover:bg-primary-50 rounded-full text-primary-600 transition"
                        title="Chat with Investor"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-gray-500 py-6">No investor profiles registered yet</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};