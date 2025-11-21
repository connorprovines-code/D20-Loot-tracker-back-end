import React, { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

const Pf2eApiSearchModal = ({ isOpen, onClose, onSelectItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const searchItems = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    try {
      // Fetch Core Rulebook items (most common items)
      const crbUrl = 'https://raw.githubusercontent.com/Pf2eToolsOrg/Pf2eTools/master/data/items/items-crb.json';
      const response = await fetch(crbUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch Pathfinder 2e items');
      }

      const data = await response.json();
      const items = data.item || [];

      // Filter by search term
      let filtered = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Filter by category if selected
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(item =>
          item.category?.toLowerCase() === selectedCategory.toLowerCase()
        );
      }

      // Limit results to 50 for performance
      filtered = filtered.slice(0, 50);

      setResults(filtered);
      if (filtered.length === 0) {
        setError('No items found matching your search.');
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Failed to fetch items from Pathfinder 2e library. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item) => {
    // Convert price to gold pieces
    let goldValue = 0;
    if (item.price) {
      const amount = item.price.amount || 0;
      const coin = item.price.coin || 'gp';

      switch (coin) {
        case 'cp': goldValue = amount / 100; break;
        case 'sp': goldValue = amount / 10; break;
        case 'gp': goldValue = amount; break;
        case 'pp': goldValue = amount * 10; break;
        default: goldValue = amount;
      }
    }

    // Convert bulk to number
    let bulkValue = null;
    if (item.bulk !== undefined && item.bulk !== null && item.bulk !== '—') {
      if (item.bulk === 'L') {
        bulkValue = 0.1;
      } else if (typeof item.bulk === 'number') {
        bulkValue = item.bulk;
      } else {
        const parsed = parseFloat(item.bulk);
        if (!isNaN(parsed)) {
          bulkValue = parsed;
        }
      }
    }

    // Format description from entries
    let description = '';
    if (item.entries && Array.isArray(item.entries)) {
      description = item.entries
        .filter(entry => typeof entry === 'string')
        .join(' ')
        .substring(0, 500); // Limit to 500 chars
    }

    // Format traits
    const traits = item.traits ? item.traits.join(', ') : '';
    const fullNotes = [
      description,
      traits ? `Traits: ${traits}` : '',
      item.usage ? `Usage: ${item.usage}` : ''
    ].filter(Boolean).join('\n\n');

    onSelectItem({
      name: item.name,
      value: goldValue,
      notes: fullNotes || '',
      bulk: bulkValue
    });

    // Reset and close
    setSearchTerm('');
    setResults([]);
    setError(null);
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchItems();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full border border-slate-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Search Pathfinder 2e Library</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Input */}
        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for items (e.g., 'longsword', 'rope')"
              className="flex-1 bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-orange-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={searchItems}
              disabled={loading || !searchTerm.trim()}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 px-4 py-2 rounded transition-colors text-white flex items-center gap-2"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              Search
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setSelectedCategory('weapon')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'weapon'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Weapons
            </button>
            <button
              onClick={() => setSelectedCategory('armor')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'armor'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Armor
            </button>
            <button
              onClick={() => setSelectedCategory('held')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'held'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Held Items
            </button>
            <button
              onClick={() => setSelectedCategory('worn')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedCategory === 'worn'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Worn Items
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {results.length > 0 ? (
            results.map((item, index) => (
              <div
                key={index}
                onClick={() => handleSelectItem(item)}
                className="bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-orange-500 rounded p-3 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white font-semibold">{item.name}</h4>
                    {item.level && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Level {item.level}
                      </span>
                    )}
                    {item.traits?.includes('uncommon') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-700 text-white">
                        Uncommon
                      </span>
                    )}
                    {item.traits?.includes('rare') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-700 text-white">
                        Rare
                      </span>
                    )}
                    {item.traits?.includes('unique') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-700 text-white">
                        Unique
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {item.bulk && item.bulk !== '—' && (
                      <span className="text-xs text-slate-400">
                        {item.bulk === 'L' ? 'L Bulk' : `${item.bulk} Bulk`}
                      </span>
                    )}
                    {item.price && (
                      <span className="text-orange-400 font-medium whitespace-nowrap">
                        {item.price.amount} {item.price.coin}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-400">{item.category || 'Item'}</p>
                {item.entries && item.entries[0] && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {typeof item.entries[0] === 'string' ? item.entries[0] : ''}
                  </p>
                )}
              </div>
            ))
          ) : (
            !loading && !error && (
              <div className="text-center text-slate-400 py-12">
                <Search size={48} className="mx-auto mb-3 opacity-50" />
                <p>Enter a search term and click Search to find items</p>
                <p className="text-sm mt-1">Searching Core Rulebook items</p>
              </div>
            )
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <Loader2 size={48} className="animate-spin mx-auto text-orange-500 mb-3" />
            <p className="text-slate-400">Searching Pathfinder 2e Library...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pf2eApiSearchModal;
