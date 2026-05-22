import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Calendar as CalendarIcon, Clock, Users, PlusCircle, Check, X, AlertTriangle, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { VideoCallModal } from '../../components/video/VideoCallModal';

interface BackendUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'entrepreneur' | 'investor';
  startupName?: string;
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

export const MeetingsPage: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contacts, setContacts] = useState<BackendUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Schedule form states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video call states
  const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null);
  const [callTargetName, setCallTargetName] = useState('');
  const [callTargetUserId, setCallTargetUserId] = useState('');

  const fetchMeetings = async () => {
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data);
    } catch (err: any) {
      toast.error('Failed to load meetings');
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/auth/users');
      // Filter out self and show opposite role
      const list = res.data.filter((u: BackendUser) => u.id !== user?.id && u.role !== user?.role);
      setContacts(list);
      if (list.length > 0) {
        setSelectedContactId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      Promise.all([fetchMeetings(), fetchContacts()]).finally(() => setIsLoading(false));
    }
  }, [user]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !title || !meetingDate || !startTime || !endTime) {
      toast.error('Please fill in all fields');
      return;
    }

    const startDateTime = new Date(`${meetingDate}T${startTime}`);
    const endDateTime = new Date(`${meetingDate}T${endTime}`);

    if (startDateTime >= endDateTime) {
      toast.error('Start time must be before end time');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/meetings/schedule', {
        inviteeId: selectedContactId,
        title,
        description,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString()
      });
      toast.success('Meeting scheduled successfully!');
      setShowScheduleModal(false);
      setTitle('');
      setDescription('');
      fetchMeetings();
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'Failed to schedule meeting';
      toast.error(errMsg, { duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (meetingId: string) => {
    try {
      await api.post(`/meetings/accept/${meetingId}`);
      toast.success('Meeting invitation accepted');
      fetchMeetings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to accept invitation');
    }
  };

  const handleReject = async (meetingId: string) => {
    try {
      await api.post(`/meetings/reject/${meetingId}`);
      toast.success('Meeting invitation rejected');
      fetchMeetings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject invitation');
    }
  };

  const handleCancel = async (meetingId: string) => {
    try {
      await api.post(`/meetings/cancel/${meetingId}`);
      toast.success('Meeting canceled');
      fetchMeetings();
    } catch (error: any) {
      toast.error('Failed to cancel meeting');
    }
  };

  const triggerCall = (meeting: Meeting) => {
    // Generate a unique room ID derived from the meeting ID
    setActiveCallRoom(meeting.id);
    const target = meeting.hostId.id === user?.id ? meeting.inviteeId : meeting.hostId;
    setCallTargetName(target.name);
    setCallTargetUserId(target.id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Segment meetings
  const now = new Date();
  
  const pendingInvitations = meetings.filter(
    m => m.status === 'pending' && m.inviteeId.id === user?.id && new Date(m.startTime) > now
  );

  const sentRequests = meetings.filter(
    m => m.status === 'pending' && m.hostId.id === user?.id && new Date(m.startTime) > now
  );

  const upcomingMeetings = meetings.filter(
    m => m.status === 'accepted' && new Date(m.endTime) > now
  );

  const pastMeetings = meetings.filter(
    m => m.status === 'rejected' || m.status === 'canceled' || new Date(m.endTime) < now
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge variant="success">Accepted</Badge>;
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      case 'rejected': return <Badge variant="error">Rejected</Badge>;
      case 'canceled': return <Badge variant="gray">Canceled</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Calendar</h1>
          <p className="text-gray-600">Schedule calls and review collaboration requests</p>
        </div>
        <Button leftIcon={<PlusCircle size={18} />} onClick={() => setShowScheduleModal(true)}>
          Schedule Pitch
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Pending Requests & Invites */}
        <div className="lg:col-span-1 space-y-6">
          {/* Incoming Invites */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-primary-600" />
                Pending Invitations ({pendingInvitations.length})
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {pendingInvitations.length > 0 ? (
                pendingInvitations.map(meeting => (
                  <div key={meeting.id} className="border border-gray-150 rounded-lg p-3 space-y-3 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <Avatar src={meeting.hostId.avatarUrl} alt={meeting.hostId.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase text-primary-700">{meeting.hostId.role}</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{meeting.hostId.name}</p>
                        {meeting.hostId.startupName && <p className="text-xs text-gray-500 truncate">{meeting.hostId.startupName}</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">{meeting.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{meeting.description || 'No description provided.'}</p>
                    </div>
                    <div className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-100 space-y-1">
                      <div className="flex items-center gap-1 font-medium">
                        <CalendarIcon size={12} /> {new Date(meeting.startTime).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="success" size="sm" fullWidth leftIcon={<Check size={14} />} onClick={() => handleAccept(meeting.id)}>
                        Accept
                      </Button>
                      <Button variant="outline" size="sm" fullWidth className="text-error-600 border-error-200 hover:bg-error-50" leftIcon={<X size={14} />} onClick={() => handleReject(meeting.id)}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No pending invitations</p>
              )}
            </CardBody>
          </Card>

          {/* Sent Invites */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-secondary-600" />
                Sent Requests ({sentRequests.length})
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {sentRequests.length > 0 ? (
                sentRequests.map(meeting => (
                  <div key={meeting.id} className="border border-gray-150 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar src={meeting.inviteeId.avatarUrl} alt={meeting.inviteeId.name} size="xs" />
                        <span className="text-sm font-semibold text-gray-800">{meeting.inviteeId.name}</span>
                      </div>
                      {getStatusBadge(meeting.status)}
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">{meeting.title}</h4>
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>{new Date(meeting.startTime).toLocaleDateString()}</span>
                      <span>{new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full text-error-600 hover:bg-error-50 mt-1" onClick={() => handleCancel(meeting.id)}>
                      Cancel Invite
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No sent requests</p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Side: Upcoming Meetings & Past Log */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active / Confirmed Meetings */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Confirmed Schedules ({upcomingMeetings.length})</h2>
            </CardHeader>
            <CardBody>
              {upcomingMeetings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingMeetings.map(meeting => {
                    const withUser = meeting.hostId.id === user?.id ? meeting.inviteeId : meeting.hostId;
                    return (
                      <div key={meeting.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-200 hover:shadow-sm transition-all bg-white gap-4">
                        <div className="flex items-start gap-4">
                          <Avatar src={withUser.avatarUrl} alt={withUser.name} size="md" />
                          <div>
                            <h3 className="font-bold text-gray-900 text-base">{meeting.title}</h3>
                            <p className="text-sm text-gray-600 mt-0.5">{meeting.description}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1 font-semibold text-gray-700">
                                <CalendarIcon size={14} />
                                {new Date(meeting.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-100 font-medium">
                                With {withUser.name} ({withUser.role})
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex md:flex-col gap-2 justify-end">
                          <Button variant="primary" leftIcon={<Video size={16} />} onClick={() => triggerCall(meeting)}>
                            Join Video Call
                          </Button>
                          <Button variant="ghost" size="sm" className="text-error-600 hover:bg-error-50 text-xs" onClick={() => handleCancel(meeting.id)}>
                            Cancel Call
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CalendarIcon size={36} className="mx-auto text-gray-300 mb-2" />
                  <p>No upcoming meetings confirmed</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowScheduleModal(true)}>
                    Schedule your first call
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Past Log */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Past & Inactive Logs</h2>
            </CardHeader>
            <CardBody>
              {pastMeetings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="py-2">Title</th>
                        <th className="py-2">With</th>
                        <th className="py-2">Date</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {pastMeetings.map(meeting => {
                        const withUser = meeting.hostId.id === user?.id ? meeting.inviteeId : meeting.hostId;
                        return (
                          <tr key={meeting.id}>
                            <td className="py-3 font-medium">{meeting.title}</td>
                            <td className="py-3">{withUser.name}</td>
                            <td className="py-3">{new Date(meeting.startTime).toLocaleDateString()}</td>
                            <td className="py-3">{getStatusBadge(meeting.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4 text-xs">No historical meeting logs found</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">Schedule Collaboration Pitch</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowScheduleModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Select connection</label>
                {contacts.length > 0 ? (
                  <select 
                    className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                  >
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role === 'investor' ? 'Investor' : c.startupName || 'Entrepreneur'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-error-600 bg-error-50 p-2 rounded border border-error-100 flex items-center gap-1">
                    <AlertTriangle size={14} /> No connections available to pitch.
                  </p>
                )}
              </div>

              <Input 
                label="Topic / Pitch Title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                placeholder="Series A Funding Pitch"
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Short Description</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-md p-2 text-sm" 
                  rows={3} 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Review business model canvas and financial model..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Date" 
                  type="date" 
                  value={meetingDate} 
                  onChange={(e) => setMeetingDate(e.target.value)} 
                  required 
                  min={new Date().toISOString().split('T')[0]}
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Timeslots</label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="time" 
                      className="border border-gray-300 rounded-md p-2 text-sm w-full"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                    <span className="text-gray-400">to</span>
                    <input 
                      type="time" 
                      className="border border-gray-300 rounded-md p-2 text-sm w-full"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSubmitting} disabled={contacts.length === 0}>
                  Book Pitch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WebRTC Video Calling Window */}
      {activeCallRoom && (
        <VideoCallModal 
          roomId={activeCallRoom} 
          targetName={callTargetName}
          targetUserId={callTargetUserId}
          onClose={() => setActiveCallRoom(null)} 
        />
      )}
    </div>
  );
};
