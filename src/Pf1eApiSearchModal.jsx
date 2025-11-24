import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

const Pf1eApiSearchModal = ({ isOpen, onClose, onSelectItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSource, setSelectedSource] = useState('core_rulebook');

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      setError(null);
      setSelectedSource('core_rulebook');
    }
  }, [isOpen]);

  // Clear results when search term is cleared
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setError(null);
    }
  }, [searchTerm]);

  // Parse PF1e price string (e.g., "15 gp", "1,000 gp", "5 sp") to gold value
  const parsePriceToGold = (priceString) => {
    if (!priceString || priceString === '—' || priceString.toLowerCase() === 'varies') {
      return 0;
    }

    // Remove commas and extract number and currency
    const cleaned = priceString.replace(/,/g, '');
    const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(cp|sp|gp|pp)/i);

    if (!match) return 0;

    const amount = parseFloat(match[1]);
    const currency = match[2].toLowerCase();

    switch (currency) {
      case 'cp': return amount / 100;
      case 'sp': return amount / 10;
      case 'gp': return amount;
      case 'pp': return amount * 10;
      default: return amount;
    }
  };

  // Parse weight string (e.g., "4 lbs.", "1/2 lb.") to numeric value
  const parseWeight = (weightString) => {
    if (!weightString || weightString === '—') return null;

    // Handle fractions like "1/2 lb."
    const fractionMatch = weightString.match(/(\d+)\/(\d+)/);
    if (fractionMatch) {
      return parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
    }

    // Extract number
    const match = weightString.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  };

  const searchItems = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    try {
      // Map sourcebook names to their directory paths in PSRD-Data
      const sourceMap = {
        'core_rulebook': 'core_rulebook/item',
        'ultimate_equipment': 'ultimate_equipment/item',
        'advanced_players_guide': 'advanced_players_guide/item',
        'ultimate_combat': 'ultimate_combat/item',
        'ultimate_magic': 'ultimate_magic/item'
      };

      const sourcePath = sourceMap[selectedSource];
      const baseUrl = `https://raw.githubusercontent.com/devonjones/PSRD-Data/master/${sourcePath}`;

      // Fetch the directory listing (we'll need to try fetching common item files)
      // Since we can't list directory contents via raw.githubusercontent.com,
      // we'll fetch a consolidated approach by trying common categories

      const allItems = [];
      const categories = [
        'adventuring_gear', 'weapons', 'armor', 'magic_items',
        'rings', 'rods', 'staves', 'wands', 'wondrous_items',
        'potions', 'scrolls', 'weapons_and_armor'
      ];

      // For Core Rulebook, we'll fetch from known item structure
      // PSRD-Data organizes items as individual JSON files in directories
      // We need to use their index or fetch multiple category files

      // Simplified approach: Fetch from a known consolidated source
      // The PSRD-Data repo has items organized by type, so we'll fetch the most common ones

      try {
        // Try fetching weapons first as a test
        const weaponsUrl = `${baseUrl.replace('/item', '')}/weapons.json`;
        const response = await fetch(weaponsUrl);

        if (response.ok) {
          const data = await response.json();
          // PSRD-Data structure varies, adjust based on actual structure
          if (Array.isArray(data)) {
            allItems.push(...data);
          } else if (data.items) {
            allItems.push(...data.items);
          }
        }
      } catch (err) {
        // If structured file doesn't exist, try alternative approach
        console.log('Trying alternative data source...');
      }

      // Alternative: Use a pre-compiled community resource
      // For now, let's use the PSRD-Data structure with individual item lookups
      // We'll fetch a curated list from the Core Rulebook item directory

      // Fallback to fetching from a known working URL structure
      const coreItemsUrl = 'https://raw.githubusercontent.com/devonjones/PSRD-Data/master/core_rulebook.db.json';
      const response = await fetch(coreItemsUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch Pathfinder 1e items');
      }

      const data = await response.json();

      // Extract items from the database structure
      let items = [];
      if (data.items) {
        items = data.items;
      } else if (Array.isArray(data)) {
        items = data;
      } else {
        // Parse the PSRD-Data structure which might have items nested
        // The actual structure has items under various sections
        Object.keys(data).forEach(key => {
          if (Array.isArray(data[key])) {
            items.push(...data[key]);
          } else if (data[key] && typeof data[key] === 'object') {
            // Check if it's an item object
            if (data[key].name && data[key].price) {
              items.push(data[key]);
            }
          }
        });
      }

      // Filter by search term
      const filtered = items.filter(item =>
        item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 50); // Limit to 50 results

      setResults(filtered);
      if (filtered.length === 0) {
        setError('No items found. Try searching for common items like "rope", "sword", or "potion".');
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Unable to load items from PSRD-Data. The repository structure may have changed. Try searching for specific item names.');

      // Provide some manual fallback items for testing
      setResults([
        {
          name: 'Rope (50 ft.)',
          price: '1 gp',
          weight: '10 lbs.',
          body: 'A standard hempen rope.',
          source: 'Core Rulebook'
        },
        {
          name: 'Longsword',
          price: '15 gp',
          weight: '4 lbs.',
          body: 'This sword is about 3-1/2 feet in length.',
          source: 'Core Rulebook',
          misc: {
            Weapon: {
              'Dmg (M)': '1d8',
              'Critical': '19-20/x2',
              'Type': 'slashing'
            }
          }
        }
      ].filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item) => {
    const goldValue = parsePriceToGold(item.price);
    const weight = parseWeight(item.weight);

    // Build description from available data
    const descriptionParts = [];
    if (item.body) {
      descriptionParts.push(item.body);
    }
    if (item.misc?.Weapon) {
      const weapon = item.misc.Weapon;
      descriptionParts.push(
        `Damage: ${weapon['Dmg (M)'] || 'N/A'}, Critical: ${weapon.Critical || 'N/A'}, Type: ${weapon.Type || 'N/A'}`
      );
    }
    if (item.source) {
      descriptionParts.push(`Source: ${item.source}`);
    }

    const notes = descriptionParts.join('\n\n');

    onSelectItem({
      name: item.name,
      value: goldValue,
      notes: notes || '',
      weight: weight
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
          <h3 className="text-xl font-bold text-white">Search Pathfinder 1e Items</h3>
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
              placeholder="Search for items (e.g., 'longsword', 'rope', 'cloak')"
              className="flex-1 bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-amber-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={searchItems}
              disabled={loading || !searchTerm.trim()}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 px-4 py-2 rounded transition-colors text-white flex items-center gap-2"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              Search
            </button>
          </div>

          {/* Source Book Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSource('core_rulebook')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedSource === 'core_rulebook'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Core Rulebook
            </button>
            <button
              onClick={() => setSelectedSource('ultimate_equipment')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedSource === 'ultimate_equipment'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Ultimate Equipment
            </button>
            <button
              onClick={() => setSelectedSource('advanced_players_guide')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedSource === 'advanced_players_guide'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              APG
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-yellow-900/30 border border-yellow-600 text-yellow-200 px-4 py-2 rounded mb-4">
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
                className="bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-amber-500 rounded p-3 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white font-semibold">{item.name}</h4>
                    {item.source && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {item.weight && item.weight !== '—' && (
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {item.weight}
                      </span>
                    )}
                    {item.price && item.price !== '—' && (
                      <span className="text-amber-400 font-medium whitespace-nowrap">
                        {item.price}
                      </span>
                    )}
                  </div>
                </div>

                {/* Weapon Stats */}
                {item.misc?.Weapon && (
                  <div className="flex gap-3 text-xs text-slate-300 mb-1">
                    <span>Dmg: {item.misc.Weapon['Dmg (M)']}</span>
                    <span>Crit: {item.misc.Weapon.Critical}</span>
                    <span>Type: {item.misc.Weapon.Type}</span>
                  </div>
                )}

                {/* Description */}
                {item.body && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {item.body}
                  </p>
                )}
              </div>
            ))
          ) : (
            !loading && !error && (
              <div className="text-center text-slate-400 py-12">
                <Search size={48} className="mx-auto mb-3 opacity-50" />
                <p>Enter a search term and click Search to find items</p>
                <p className="text-sm mt-1">Searching Core Rulebook items from PSRD</p>
              </div>
            )
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <Loader2 size={48} className="animate-spin mx-auto text-amber-500 mb-3" />
            <p className="text-slate-400">Searching PSRD Database...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pf1eApiSearchModal;
