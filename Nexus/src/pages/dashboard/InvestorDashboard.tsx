import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, PieChart, Filter, Search, PlusCircle, RefreshCw, HandHelping } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EntrepreneurCard } from '../../components/entrepreneur/EntrepreneurCard';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface BackendUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'entrepreneur' | 'investor';
  startupName?: string;
  industry?: string;
  pitchSummary?: string;
  fundingNeeded?: string;
  location?: string;
  foundedYear?: number;
  teamSize?: number;
  isOnline: boolean;
}

interface Meeting {
  id: string;
  hostId: BackendUser;
  inviteeId: BackendUser;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
}

export const InvestorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [entrepreneurs, setEntrepreneurs] = useState<BackendUser[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);

  const fetchDashboardData = async () => {
    try {
      const [usersRes, meetingsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/meetings')
      ]);
      // Filter for entrepreneurs
      const list = usersRes.data.filter((u: BackendUser) => u.role === 'entrepreneur');
      setEntrepreneurs(list);
      setMeetings(meetingsRes.data);
    } catch (err) {
      console.error('Error fetching investor dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Filter entrepreneurs based on search query and industry filters
  const filteredEntrepreneurs = entrepreneurs.filter(entrepreneur => {
    const matchesSearch = searchQuery === '' || 
      entrepreneur.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entrepreneur.startupName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entrepreneur.industry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entrepreneur.pitchSummary || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesIndustry = selectedIndustries.length === 0 || 
      (entrepreneur.industry && selectedIndustries.includes(entrepreneur.industry));
    
    return matchesSearch && matchesIndustry;
  });

  // Get unique list of industries for filter pill list
  const industries = Array.from(new Set(
    entrepreneurs
      .map(e => e.industry || '')
      .filter(ind => ind !== '')
  ));

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prevSelected => 
      prevSelected.includes(industry)
        ? prevSelected.filter(i => i !== industry)
        : [...prevSelected, industry]
    );
  };

  // Metrics
  const totalConnectionsCount = Array.from(new Set(
    meetings.filter(m => m.status === 'accepted')
      .map(m => m.hostId.id === user.id ? m.inviteeId.id : m.hostId.id)
  )).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Discover Startups</h1>
          <p className="text-gray-600">Explore pitches, check startup financials, and start collaborations</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={fetchDashboardData}
            className="p-2 border border-gray-300 rounded-md hover:bg-gray-100 transition text-gray-500 hover:text-gray-700"
            title="Refresh Dashboard"
          >
            <RefreshCw size={18} />
          </button>
          <Link to="/entrepreneurs">
            <Button leftIcon={<PlusCircle size={18} />}>
              View All Startups
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Search and Industry filter bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="w-full md:w-2/3">
          <Input
            placeholder="Search startup name, keywords, or industries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            startAdornment={<Search size={18} className="text-gray-400" />}
          />
        </div>
        
        <div className="w-full md:w-1/3 flex flex-col gap-1.5">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Filter size={14} />
            <span>Industries Filter:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {industries.length > 0 ? (
              industries.map(industry => (
                <Badge
                  key={industry}
                  variant={selectedIndustries.includes(industry) ? 'primary' : 'gray'}
                  className="cursor-pointer select-none hover:bg-primary-50 hover:text-primary-700 transition"
                  onClick={() => toggleIndustry(industry)}
                >
                  {industry}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-gray-400 italic">No industries populated</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Dynamic Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary-50 border border-primary-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-full mr-4 text-primary-700">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Total Startups</p>
                <h3 className="text-2xl font-bold text-primary-950 mt-0.5">{entrepreneurs.length}</h3>
              </div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="bg-secondary-50 border border-secondary-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-secondary-100 rounded-full mr-4 text-secondary-700">
                <PieChart size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">Industries Represented</p>
                <h3 className="text-2xl font-bold text-secondary-950 mt-0.5">{industries.length}</h3>
              </div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="bg-accent-50 border border-accent-100 shadow-sm">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-accent-100 rounded-full mr-4 text-accent-700">
                <HandHelping size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-accent-700 uppercase tracking-wider">Active Connections</p>
                <h3 className="text-2xl font-bold text-accent-950 mt-0.5">{totalConnectionsCount}</h3>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      
      {/* Featured Startups Grid */}
      <div>
        <Card>
          <CardHeader className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Featured Startups</h2>
          </CardHeader>
          
          <CardBody className="pt-6">
            {filteredEntrepreneurs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEntrepreneurs.map(entrepreneur => (
                  <EntrepreneurCard
                    key={entrepreneur.id}
                    entrepreneur={entrepreneur as any}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500 font-medium">No startups match your search criteria</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedIndustries([]);
                  }}
                >
                  Reset all filters
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};