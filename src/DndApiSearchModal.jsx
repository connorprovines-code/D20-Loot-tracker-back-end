import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

const DndApiSearchModal = ({ isOpen, onClose, onSelectItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('all');

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      setError(null);
      setSelectedType('all');
    }
  }, [isOpen]);

  // Clear results when search term is cleared
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setError(null);
    }
  }, [searchTerm]);

  const searchItems = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const allResults = [];

      // Search equipment if selected
      if (selectedType === 'all' || selectedType === 'equipment') {
        const equipmentRes = await fetch('https://www.dnd5eapi.co/api/equipment');
        const equipmentData = await equipmentRes.json();

        // Filter equipment by search term
        const filteredEquipment = equipmentData.results
          .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(item => ({ ...item, type: 'equipment' }));

        // Fetch details for each equipment item
        for (const item of filteredEquipment.slice(0, 10)) { // Limit to 10 for performance
          const detailRes = await fetch(`https://www.dnd5eapi.co${item.url}`);
          const detailData = await detailRes.json();
          allResults.push({
            name: detailData.name,
            type: 'equipment',
            cost: detailData.cost,
            weight: detailData.weight,
            desc: detailData.desc || [],
            equipment_category: detailData.equipment_category?.name || 'Equipment',
            rarity: 'common'
          });
        }
      }

      // Search magic items if selected
      if (selectedType === 'all' || selectedType === 'magic-items') {
        const magicRes = await fetch('https://www.dnd5eapi.co/api/magic-items');
        const magicData = await magicRes.json();

        // Filter magic items by search term
        const filteredMagic = magicData.results
          .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(item => ({ ...item, type: 'magic-item' }));

        // Fetch details for each magic item
        for (const item of filteredMagic.slice(0, 10)) { // Limit to 10 for performance
          const detailRes = await fetch(`https://www.dnd5eapi.co${item.url}`);
          const detailData = await detailRes.json();

          // Extract cost from description if available (magic items don't have structured cost)
          let estimatedCost = { quantity: 0, unit: 'gp' };
          const desc = detailData.desc?.join(' ') || '';

          // Try to estimate value based on rarity
          const rarityValues = {
            'common': { quantity: 100, unit: 'gp' },
            'uncommon': { quantity: 500, unit: 'gp' },
            'rare': { quantity: 5000, unit: 'gp' },
            'very rare': { quantity: 50000, unit: 'gp' },
            'legendary': { quantity: 500000, unit: 'gp' },
            'artifact': { quantity: 0, unit: 'gp' }
          };

          if (detailData.rarity?.name) {
            estimatedCost = rarityValues[detailData.rarity.name.toLowerCase()] || estimatedCost;
          }

          allResults.push({
            name: detailData.name,
            type: 'magic-item',
            cost: estimatedCost,
            desc: detailData.desc || [],
            equipment_category: 'Magic Item',
            rarity: detailData.rarity?.name?.toLowerCase() || 'unknown',
            requires_attunement: desc.toLowerCase().includes('requires attunement')
          });
        }
      }

      setResults(allResults);
      if (allResults.length === 0) {
        setError('No items found matching your search.');
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Failed to fetch items from D&D 5e API. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item) => {
    // Convert cost to gold pieces
    let goldValue = 0;
    if (item.cost) {
      switch (item.cost.unit) {
        case 'cp': goldValue = item.cost.quantity / 100; break;
        case 'sp': goldValue = item.cost.quantity / 10; break;
        case 'ep': goldValue = item.cost.quantity / 2; break;
        case 'gp': goldValue = item.cost.quantity; break;
        case 'pp': goldValue = item.cost.quantity * 10; break;
        default: goldValue = item.cost.quantity;
      }
    }

    // Format description
    const description = Array.isArray(item.desc) ? item.desc.join(' ') : item.desc;

    onSelectItem({
      name: item.name,
      value: goldValue,
      notes: description || '',
      rarity: item.rarity || null,
      requires_attunement: item.requires_attunement || false
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-4 sm:p-6 max-w-sm sm:max-w-md lg:max-w-2xl w-full border border-slate-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Search D&D 5e Items</h3>
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
              placeholder="Search for items (e.g., 'longsword', 'cloak')"
              className="flex-1 bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 focus:border-cyan-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={searchItems}
              disabled={loading || !searchTerm.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 px-4 py-2 rounded transition-colors text-white flex items-center gap-2"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              Search
            </button>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedType === 'all'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setSelectedType('equipment')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedType === 'equipment'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Equipment
            </button>
            <button
              onClick={() => setSelectedType('magic-items')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedType === 'magic-items'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Magic Items
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
                className="bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-cyan-500 rounded p-3 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-semibold">{item.name}</h4>
                    {item.rarity && item.rarity !== 'common' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.rarity === 'uncommon' ? 'bg-green-600 text-white' :
                        item.rarity === 'rare' ? 'bg-blue-600 text-white' :
                        item.rarity === 'very rare' ? 'bg-purple-600 text-white' :
                        item.rarity === 'legendary' ? 'bg-orange-600 text-white' :
                        item.rarity === 'artifact' ? 'bg-red-600 text-white' :
                        'bg-slate-600 text-white'
                      }`}>
                        {item.rarity}
                      </span>
                    )}
                    {item.requires_attunement && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-600 text-white">
                        Attunement
                      </span>
                    )}
                  </div>
                  <span className="text-cyan-400 font-medium">
                    {item.cost.quantity > 0 ? `${item.cost.quantity} ${item.cost.unit}` : 'Priceless'}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{item.equipment_category}</p>
                {item.desc && item.desc.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {Array.isArray(item.desc) ? item.desc[0] : item.desc}
                  </p>
                )}
              </div>
            ))
          ) : (
            !loading && !error && (
              <div className="text-center text-slate-400 py-12">
                <Search size={48} className="mx-auto mb-3 opacity-50" />
                <p>Enter a search term and click Search to find items</p>
                <p className="text-sm mt-1">Try "longsword", "cloak", or "potion"</p>
              </div>
            )
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <Loader2 size={48} className="animate-spin mx-auto text-cyan-500 mb-3" />
            <p className="text-slate-400">Searching D&D 5e API...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DndApiSearchModal;
