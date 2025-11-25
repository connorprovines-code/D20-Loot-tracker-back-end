import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import CampaignSelector from './CampaignSelector';
import AcceptInvite from './AcceptInvite';
import App from './App';

const AppWrapper = () => {
  const [user, setUser] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState(null);

  useEffect(() => {
    // Check for invite token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invite');
    if (token) {
      setInviteToken(token);
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSelectedCampaign(null);
  };

  const handleBackToCampaigns = () => {
    setSelectedCampaign(null);
    // Clear invite token from URL
    if (inviteToken) {
      window.history.replaceState({}, '', window.location.pathname);
      setInviteToken(null);
    }
  };

  const handleInviteAccepted = (campaignId) => {
    // Clear invite token and redirect to campaigns
    window.history.replaceState({}, '', window.location.pathname);
    setInviteToken(null);
    alert('Successfully joined campaign! Opening campaign selector...');
  };

  const handleInviteDeclined = () => {
    // Clear invite token and redirect to campaigns
    window.history.replaceState({}, '', window.location.pathname);
    setInviteToken(null);
    alert('Invite declined');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Show login if no user
  if (!user) {
    return <Auth onAuthSuccess={setUser} />;
  }

  // Show accept invite screen if there's an invite token
  if (inviteToken && !selectedCampaign) {
    return (
      <AcceptInvite
        inviteToken={inviteToken}
        user={user}
        onAccepted={handleInviteAccepted}
        onDeclined={handleInviteDeclined}
      />
    );
  }

  // Show campaign selector if no campaign selected
  if (!selectedCampaign) {
    return (
      <CampaignSelector
        user={user}
        onSelectCampaign={setSelectedCampaign}
        onLogout={handleLogout}
      />
    );
  }

  // Show main app with selected campaign
  return (
    <App
      user={user}
      campaign={selectedCampaign}
      onBackToCampaigns={handleBackToCampaigns}
      onLogout={handleLogout}
    />
  );
};

export default AppWrapper;
