import React from 'react';
import { Dice6, LogOut } from 'lucide-react';

const Navbar = ({ user, campaign, onBackToCampaigns, onLogout }) => {
  return (
    <nav className="bg-slate-900 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo + Campaign Name */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={onBackToCampaigns}
              className="flex items-center gap-1 sm:gap-2 text-cyan-400 hover:text-cyan-300 transition-colors group flex-shrink-0"
              title="Back to Campaigns"
            >
              <Dice6 size={20} className="sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform" />
              <span className="font-bold text-base sm:text-lg hidden sm:inline">D20 Loot Tracker</span>
            </button>

            {campaign && (
              <>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-white font-medium text-sm sm:text-base truncate max-w-[100px] sm:max-w-xs">
                  {campaign.name}
                </span>
              </>
            )}
          </div>

          {/* Right: User + Logout */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <span className="text-slate-400 text-xs sm:text-sm hidden md:inline truncate max-w-[120px] sm:max-w-[200px]">
              {user?.email}
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 sm:gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-red-500 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all text-slate-300 hover:text-red-400 text-xs sm:text-sm"
              title="Logout"
            >
              <LogOut size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
