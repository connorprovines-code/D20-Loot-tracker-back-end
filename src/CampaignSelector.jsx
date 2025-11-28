import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Trash2, Edit2, Check, X, UserPlus, Users } from 'lucide-react';
import InviteMemberModal from './InviteMemberModal';
import ManageMembersModal from './ManageMembersModal';
import Navbar from './Navbar';

const CampaignSelector = ({ user, onSelectCampaign, onLogout }) => {
  const [campaignMemberships, setCampaignMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSystem, setNewCampaignSystem] = useState('dnd-5e');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const getSuggestedCampaignName = () => {
    const ownedCount = campaignMemberships.filter(m => m.role === 'owner').length;
    return `Campaign #${ownedCount + 1}`;
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
      // Use database function to bypass RLS and avoid recursion
      const { data, error } = await supabase.rpc('get_user_campaigns', {
        p_user_id: user.id
      });

      if (error) throw error;

      // Transform flat response to match expected nested structure
      const transformed = (data || []).map(row => ({
        role: row.user_role,
        joined_at: row.joined_at,
        campaigns: {
          id: row.campaign_id,
          name: row.campaign_name,
          owner_id: row.owner_id,
          game_system: row.game_system,
          party_fund_gets_share: row.party_fund_gets_share,
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      }));

      setCampaignMemberships(transformed);
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

  const handleDeleteCampaign = async () => {
    const campaignId = selectedCampaignForModal?.id;
    if (!campaignId) return;

    if (deleteConfirmation !== selectedCampaignForModal.name) {
      alert('Campaign name does not match. Please type the exact campaign name to confirm deletion.');
      return;
    }

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      await loadCampaigns();
      setShowDeleteModal(false);
      setSelectedCampaignForModal(null);
      setDeleteConfirmation('');
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Error deleting campaign: ' + error.message);
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

  const handleLeaveCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to leave this campaign?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaign_members')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id);

      if (error) throw error;
      await loadCampaigns();
    } catch (error) {
      console.error('Error leaving campaign:', error);
      alert('Error leaving campaign');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      owner: { text: 'Owner', color: 'bg-cyan-600' },
      contributor: { text: 'Contributor', color: 'bg-purple-600' },
      viewer: { text: 'Viewer', color: 'bg-slate-600' }
    };
    return badges[role] || badges.viewer;
  };

  const renderCampaignCard = (membership, isOwner) => {
    const campaign = membership.campaigns;
    const roleBadge = getRoleBadge(membership.role);

    return (
      <div
        key={campaign.id}
        className="bg-slate-800 rounded-lg p-5 border border-slate-700 hover:border-cyan-600 transition-all"
      >
        {/* Header Row */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            {editingId === campaign.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white flex-1"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdateCampaign(campaign.id)}
                  className="bg-green-600 hover:bg-green-700 p-2 rounded transition-colors"
                  title="Save"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditingName('');
                  }}
                  className="bg-slate-600 hover:bg-slate-700 p-2 rounded transition-colors"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-white mb-2">{campaign.name}</h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`${getSystemDisplayInfo(campaign.game_system).color} text-white px-2 py-0.5 rounded text-xs font-medium`}>
                    {getSystemDisplayInfo(campaign.game_system).name}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className={`${roleBadge.color} text-white px-2 py-0.5 rounded text-xs font-medium`}>
                    {roleBadge.text}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    {isOwner ? 'Created' : 'Joined'} {new Date(isOwner ? campaign.created_at : membership.joined_at).toLocaleDateString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions Row */}
        {editingId !== campaign.id && (
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-700">
            <div className="flex items-center gap-2">
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      setSelectedCampaignForModal(campaign);
                      setShowInviteModal(true);
                    }}
                    className="bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 text-green-400 px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors font-medium"
                    title="Invite Members"
                  >
                    <UserPlus size={14} />
                    <span>Invite</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCampaignForModal(campaign);
                      setShowManageMembersModal(true);
                    }}
                    className="bg-purple-600/10 hover:bg-purple-600/20 border border-purple-600/30 text-purple-400 px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors font-medium"
                    title="Manage Members"
                  >
                    <Users size={14} />
                    <span>Manage</span>
                  </button>
                </>
              )}
              {(isOwner || membership.role === 'dm') && (
                <button
                  onClick={() => {
                    setEditingId(campaign.id);
                    setEditingName(campaign.name);
                  }}
                  className="bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-600/30 text-cyan-400 px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors font-medium"
                  title="Edit Campaign Name"
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
              )}
              {isOwner ? (
                <button
                  onClick={() => {
                    setSelectedCampaignForModal(campaign);
                    setShowDeleteModal(true);
                  }}
                  className="bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-400 px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors font-medium"
                  title="Delete Campaign"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              ) : (
                <button
                  onClick={() => handleLeaveCampaign(campaign.id)}
                  className="bg-orange-600/10 hover:bg-orange-600/20 border border-orange-600/30 text-orange-400 px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors font-medium"
                  title="Leave Campaign"
                >
                  Leave
                </button>
              )}
            </div>
            <button
              onClick={() => onSelectCampaign(campaign)}
              className="bg-cyan-600 hover:bg-cyan-700 px-6 py-2 rounded-lg font-medium transition-colors text-white"
            >
              Open Campaign
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <Navbar user={user} onLogout={onLogout} />

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Your Campaigns</h1>
          <p className="text-sm text-slate-400">Select or create a campaign to get started</p>
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
        {campaignMemberships.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-400 border border-slate-700">
            <p className="text-lg mb-2">No campaigns yet</p>
            <p className="text-sm">Create your first campaign to get started!</p>
          </div>
        ) : (
          <>
            {/* My Campaigns (Owner) */}
            {campaignMemberships.filter(m => m.role === 'owner').length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                  My Campaigns
                  <span className="text-sm text-slate-400 font-normal">
                    ({campaignMemberships.filter(m => m.role === 'owner').length})
                  </span>
                </h2>
                <div className="space-y-4">
                  {campaignMemberships
                    .filter(m => m.role === 'owner')
                    .map((membership) => renderCampaignCard(membership, true))}
                </div>
              </div>
            )}

            {/* Shared With Me */}
            {campaignMemberships.filter(m => m.role !== 'owner').length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                  Shared With Me
                  <span className="text-sm text-slate-400 font-normal">
                    ({campaignMemberships.filter(m => m.role !== 'owner').length})
                  </span>
                </h2>
                <div className="space-y-4">
                  {campaignMemberships
                    .filter(m => m.role !== 'owner')
                    .map((membership) => renderCampaignCard(membership, false))}
                </div>
              </div>
            )}
          </>
        )}
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

      {/* Invite Member Modal */}
      {showInviteModal && selectedCampaignForModal && (
        <InviteMemberModal
          campaign={selectedCampaignForModal}
          onClose={() => {
            setShowInviteModal(false);
            setSelectedCampaignForModal(null);
          }}
          onInviteSent={() => {
            // Optionally refresh data
            loadCampaigns();
          }}
        />
      )}

      {/* Manage Members Modal */}
      {showManageMembersModal && selectedCampaignForModal && (
        <ManageMembersModal
          campaign={selectedCampaignForModal}
          currentUserId={user.id}
          onClose={() => {
            setShowManageMembersModal(false);
            setSelectedCampaignForModal(null);
          }}
          onMembersChanged={() => {
            loadCampaigns();
          }}
        />
      )}

      {/* Delete Campaign Confirmation Modal */}
      {showDeleteModal && selectedCampaignForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-red-700">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 size={24} className="text-red-400" />
              <h3 className="text-xl font-bold text-white">Delete Campaign</h3>
            </div>

            <div className="mb-4 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded">
              <p className="text-red-200 font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
              <p className="text-red-300 text-sm">
                This will permanently delete:
              </p>
              <ul className="text-red-300 text-sm list-disc list-inside mt-2 space-y-1">
                <li>All players in this campaign</li>
                <li>All inventory items</li>
                <li>All transaction history</li>
                <li>All campaign settings and data</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-2">
                Type the campaign name <span className="text-red-400 font-bold">"{selectedCampaignForModal.name}"</span> to confirm deletion:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-red-500 focus:outline-none"
                placeholder={selectedCampaignForModal.name}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedCampaignForModal(null);
                  setDeleteConfirmation('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCampaign}
                disabled={deleteConfirmation !== selectedCampaignForModal.name}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded transition-colors text-white font-medium"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignSelector;
