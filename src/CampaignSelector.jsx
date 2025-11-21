import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, LogOut, Trash2, Edit2, Check, X } from 'lucide-react';

const CampaignSelector = ({ user, onSelectCampaign, onLogout }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSystem, setNewCampaignSystem] = useState('dnd-5e');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const getSuggestedCampaignName = () => {
    return `Campaign #${campaigns.length + 1}`;
  };

  const getSystemDisplayInfo = (system) => {
    const systemInfo = {
      'dnd-5e': { name: 'D&D 5e', color: 'bg-red-600' },
      'pathfinder-1e': { name: 'Pathfinder 1e', color: 'bg-amber-600' },
      'pathfinder-2e': { name: 'Pathfinder 2e', color: 'bg-orange-600' },
      'other': { name: 'Other System', color: 'bg-slate-600' }
    };
    return systemInfo[system] || systemInfo['other'];
  };

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      alert('Error loading campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;

    setCreating(true);
    try {
      // Call the helper function to create campaign with party_fund
      const { data, error } = await supabase.rpc('initialize_campaign', {
        campaign_name: newCampaignName.trim(),
        user_id: user.id,
        game_system: newCampaignSystem
      });

      if (error) throw error;

      // Reload campaigns
      await loadCampaigns();
      setNewCampaignName('');
      setNewCampaignSystem('dnd-5e');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Error creating campaign: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure? This will delete all players, items, and transactions in this campaign.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      await loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Error deleting campaign');
    }
  };

  const handleUpdateCampaign = async (campaignId) => {
    if (!editingName.trim()) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ name: editingName.trim() })
        .eq('id', campaignId);

      if (error) throw error;
      await loadCampaigns();
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Error updating campaign:', error);
      alert('Error updating campaign');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-1">Your Campaigns</h1>
            <p className="text-sm text-slate-400">Logged in as {user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:border-red-500 text-slate-300 hover:text-red-400"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Create Campaign Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setNewCampaignName(getSuggestedCampaignName());
              setShowCreateModal(true);
            }}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg flex items-center gap-2 transition-colors text-white font-medium"
          >
            <Plus size={20} />
            Create New Campaign
          </button>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-400 border border-slate-700">
              <p className="text-lg mb-2">No campaigns yet</p>
              <p className="text-sm">Create your first campaign to get started!</p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-cyan-600 transition-all"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    {editingId === campaign.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateCampaign(campaign.id)}
                          className="bg-green-600 hover:bg-green-700 p-2 rounded transition-colors"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingName('');
                          }}
                          className="bg-slate-600 hover:bg-slate-700 p-2 rounded transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-white">{campaign.name}</h3>
                          <span className={`${getSystemDisplayInfo(campaign.game_system).color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                            {getSystemDisplayInfo(campaign.game_system).name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {editingId !== campaign.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(campaign.id);
                            setEditingName(campaign.name);
                          }}
                          className="text-cyan-400 hover:text-cyan-300 p-2"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button
                          onClick={() => onSelectCampaign(campaign)}
                          className="bg-cyan-600 hover:bg-cyan-700 px-6 py-3 rounded-lg font-medium transition-colors text-white"
                        >
                          Open Campaign
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4 text-white">Create New Campaign</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateCampaign();
                    }
                  }}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="e.g., Campaign #1"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Game System</label>
                <select
                  value={newCampaignSystem}
                  onChange={(e) => setNewCampaignSystem(e.target.value)}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                >
                  <option value="dnd-5e">D&D 5e</option>
                  <option value="pathfinder-2e">Pathfinder 2e</option>
                  <option value="pathfinder-1e">Pathfinder 1e</option>
                  <option value="other">Other System (More coming soon!)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCampaignName('');
                  setNewCampaignSystem('dnd-5e');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={creating || !newCampaignName.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded transition-colors text-white"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignSelector;
