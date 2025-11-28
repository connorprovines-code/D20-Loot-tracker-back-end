import React from 'react';
import { Dice6, LogOut } from 'lucide-react';

const Navbar = ({ user, campaign, onBackToCampaigns, onLogout }) => {
  return (
    <nav className="bg-slate-900 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo + Campaign Name */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToCampaigns}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors group"
              title="Back to Campaigns"
            >
              <Dice6 size={24} className="group-hover:rotate-12 transition-transform" />
              <span className="font-bold text-lg hidden sm:inline">D20 Loot Tracker</span>
            </button>

            {campaign && (
              <>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-white font-medium truncate max-w-xs">
                  {campaign.name}
                </span>
              </>
            )}
          </div>

          {/* Right: User + Logout */}
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:inline truncate max-w-[200px]">
              {user?.email}
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-red-500 px-3 py-2 rounded-lg transition-all text-slate-300 hover:text-red-400"
              title="Logout"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
