import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Trash2, Coins, Package, History, ShoppingCart, MinusCircle, PlusCircle, Edit2, Settings, UserPlus, UserMinus, FileText, ArrowRightLeft, ArrowLeft, LogOut } from 'lucide-react';

const App = ({ user, campaign, onBackToCampaigns, onLogout }) => {
  const [players, setPlayers] = useState([]);
  const [activeView, setActiveView] = useState('loot');
  const [activeInventory, setActiveInventory] = useState(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [partyFundGetsShare, setPartyFundGetsShare] = useState(true);

  const [incomingLoot, setIncomingLoot] = useState([]);
  const [inventories, setInventories] = useState({});
  const [gold, setGold] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [masterLog, setMasterLog] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [buyingPlayer, setBuyingPlayer] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [transferringFrom, setTransferringFrom] = useState(null);
  const [sellingFrom, setSellingFrom] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', value: '', isTreasure: false, charges: null, consumable: false, notes: '' });
  const [bulkImportText, setBulkImportText] = useState('');
  const [parsedBulkItems, setParsedBulkItems] = useState([]);
  const [editingGold, setEditingGold] = useState(null);

  // REAL-TIME CONFIGURATION
  // Set to false to disable real-time features (kill switch)
  const ENABLE_REALTIME = true;

  // Load all data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (players.length > 0 && !activeInventory) {
      setActiveInventory(players[0]);
    }
  }, [players]);

  // Real-time subscriptions
  useEffect(() => {
    if (!ENABLE_REALTIME) return;

    console.log('🔴 Setting up real-time subscriptions...');

    // Subscribe to items changes
    const itemsChannel = supabase
      .channel('items-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'items' },
        (payload) => {
          console.log('📦 New item added:', payload.new);
          const newItem = { ...payload.new, notes: payload.new.notes || '' };

          if (newItem.status === 'incoming') {
            setIncomingLoot(prev => {
              // Avoid duplicates
              if (prev.some(i => i.id === newItem.id)) return prev;
              return [newItem, ...prev];
            });
          }

          setMasterLog(prev => {
            if (prev.some(i => i.id === newItem.id)) return prev;
            return [newItem, ...prev];
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items' },
        (payload) => {
          console.log('📝 Item updated:', payload.new);
          const updatedItem = payload.new;

          // Update master log
          setMasterLog(prev =>
            prev.map(item => item.id === updatedItem.id ? updatedItem : item)
          );

          // Handle status changes
          if (updatedItem.status === 'incoming') {
            setIncomingLoot(prev => {
              if (prev.some(i => i.id === updatedItem.id)) {
                return prev.map(i => i.id === updatedItem.id ? updatedItem : i);
              }
              return [updatedItem, ...prev];
            });
          } else {
            // Remove from incoming if status changed
            setIncomingLoot(prev => prev.filter(i => i.id !== updatedItem.id));
          }

          // Update inventories if assigned/purchased
          if (updatedItem.status === 'assigned' || updatedItem.status === 'purchased') {
            const assignedTo = updatedItem.assigned_to;
            if (assignedTo) {
              setInventories(prev => {
                const newInventories = { ...prev };
                const itemForInventory = {
                  id: updatedItem.id,
                  name: updatedItem.name,
                  value: updatedItem.value,
                  originalValue: updatedItem.original_value || updatedItem.value,
                  isTreasure: updatedItem.is_treasure,
                  charges: updatedItem.charges,
                  consumable: updatedItem.consumable,
                  notes: updatedItem.notes || ''
                };

                // Remove from all inventories first
                Object.keys(newInventories).forEach(key => {
                  newInventories[key] = newInventories[key].filter(i => i.id !== updatedItem.id);
                });

                // Add to correct inventory
                if (newInventories[assignedTo]) {
                  newInventories[assignedTo] = [...newInventories[assignedTo], itemForInventory];
                }

                return newInventories;
              });
            }
          } else if (updatedItem.status === 'sold' || updatedItem.status === 'depleted') {
            // Remove from all inventories
            setInventories(prev => {
              const newInventories = { ...prev };
              Object.keys(newInventories).forEach(key => {
                newInventories[key] = newInventories[key].filter(i => i.id !== updatedItem.id);
              });
              return newInventories;
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'items' },
        (payload) => {
          console.log('🗑️ Item deleted:', payload.old);
          const deletedId = payload.old.id;
          setIncomingLoot(prev => prev.filter(i => i.id !== deletedId));
          setMasterLog(prev => prev.filter(i => i.id !== deletedId));
          setInventories(prev => {
            const newInventories = { ...prev };
            Object.keys(newInventories).forEach(key => {
              newInventories[key] = newInventories[key].filter(i => i.id !== deletedId);
            });
            return newInventories;
          });
        }
      )
      .subscribe();

    // Subscribe to player gold changes
    const playersChannel = supabase
      .channel('players-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          console.log('💰 Player gold updated:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setGold(prev => ({
              ...prev,
              [payload.new.name]: payload.new.gold
            }));
          }
        }
      )
      .subscribe();

    // Subscribe to party fund changes
    const partyFundChannel = supabase
      .channel('party-fund-changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'party_fund' },
        (payload) => {
          console.log('🏴‍☠️ Party fund updated:', payload.new.gold);
          setGold(prev => ({
            ...prev,
            'Party Fund': payload.new.gold
          }));
        }
      )
      .subscribe();

    // Subscribe to transaction changes
    const transactionsChannel = supabase
      .channel('transactions-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          console.log('📜 New transaction:', payload.new);
          setTransactions(prev => {
            // Avoid duplicates
            if (prev.some(t => t.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    console.log('✅ Real-time subscriptions active!');

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting real-time subscriptions...');
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(partyFundChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [ENABLE_REALTIME]);

  const reloadGold = async () => {
    try {
      // Load players
      const { data: playersData } = await supabase
        .from('players')
        .select('name, gold')
        .eq('campaign_id', campaign.id)
        .order('created_at');

      // Build gold object
      const goldObj = {};
      playersData?.forEach(p => {
        goldObj[p.name] = p.gold;
      });

      // Load party fund
      const { data: partyData } = await supabase
        .from('party_fund')
        .select('gold')
        .eq('campaign_id', campaign.id)
        .single();

      goldObj['Party Fund'] = partyData?.gold || 0;
      setGold(goldObj);
    } catch (error) {
      console.error('Error reloading gold:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load campaign settings
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaign.id)
        .single();

      if (campaignData) {
        setPartyFundGetsShare(campaignData.party_fund_gets_share);
      }

      // Load players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at');

      const playerNames = playersData?.map(p => p.name) || [];
      setPlayers(playerNames);

      // Build gold object
      const goldObj = {};
      playersData?.forEach(p => {
        goldObj[p.name] = p.gold;
      });

      // Load party fund
      const { data: partyData } = await supabase
        .from('party_fund')
        .select('*')
        .eq('campaign_id', campaign.id)
        .single();

      goldObj['Party Fund'] = partyData?.gold || 0;
      setGold(goldObj);

      // Load items
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      // Separate items by status
      const incoming = itemsData?.filter(i => i.status === 'incoming').map(i => ({
        ...i,
        notes: i.notes || ''
      })) || [];
      setIncomingLoot(incoming);

      // Build inventories object
      const invs = { Party: [] };
      playerNames.forEach(name => {
        invs[name] = [];
      });

      itemsData?.filter(i => i.status === 'assigned' || i.status === 'purchased').forEach(item => {
        if (item.assigned_to && invs[item.assigned_to]) {
          invs[item.assigned_to].push({
            id: item.id,
            name: item.name,
            value: item.value,
            originalValue: item.original_value || item.value,
            isTreasure: item.is_treasure,
            charges: item.charges,
            consumable: item.consumable,
            notes: item.notes || ''
          });
        }
      });

      setInventories(invs);
      setMasterLog(itemsData || []);

      // Load transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions(txData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (type, description, amount, affectedParties) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        campaign_id: campaign.id,
        type,
        description,
        amount,
        affected_parties: affectedParties
      }])
      .select()
      .single();

    if (!error && data) {
      setTransactions(prev => [data, ...prev]);
    }
  };

  const distributeGold = async (totalGold, description) => {
    const shareCount = partyFundGetsShare ? players.length + 1 : players.length;
    const share = Math.floor(totalGold / shareCount);

    try {
      // Update all players
      for (const player of players) {
        const { error } = await supabase
          .from('players')
          .update({ gold: gold[player] + share })
          .eq('name', player)
          .eq('campaign_id', campaign.id);

        if (error) {
          console.error(`Error updating gold for ${player}:`, error);
          throw error;
        }
      }

      // Get party fund row and update it (only if party fund gets a share)
      if (partyFundGetsShare) {
        const { data: partyData, error: partyFetchError } = await supabase
          .from('party_fund')
          .select('id, gold')
          .eq('campaign_id', campaign.id)
          .single();

        if (partyFetchError) {
          console.error('Error fetching party fund:', partyFetchError);
          throw partyFetchError;
        }

        const { error: partyUpdateError } = await supabase
          .from('party_fund')
          .update({ gold: partyData.gold + share })
          .eq('id', partyData.id);

        if (partyUpdateError) {
          console.error('Error updating party fund:', partyUpdateError);
          throw partyUpdateError;
        }
      }

      // Reload gold from database to ensure sync
      await reloadGold();

      await addTransaction('sell', description, totalGold, 'all');
    } catch (error) {
      alert(`Error distributing gold: ${error.message}`);
      // Reload data to ensure UI matches database
      await loadAllData();
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.value) return;

    const { data, error } = await supabase
      .from('items')
      .insert([{
        campaign_id: campaign.id,
        name: newItem.name,
        value: parseFloat(newItem.value),
        is_treasure: newItem.isTreasure,
        charges: newItem.charges ? parseInt(newItem.charges) : null,
        consumable: newItem.consumable || false,
        notes: newItem.notes || '',
        status: 'incoming'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding item:', error);
      alert(`Error adding item: ${error.message}`);
      return;
    }

    if (data) {
      setIncomingLoot(prev => [data, ...prev]);
      setMasterLog(prev => [data, ...prev]);
    }

    setNewItem({ name: '', value: '', isTreasure: false, charges: null, consumable: false, notes: '' });
    setShowAddModal(false);
  };

  const handleSellItem = async (item) => {
    const sellValue = item.is_treasure ? item.value : Math.floor(item.value * 0.5);
    await distributeGold(sellValue, `Sold ${item.name} (${item.is_treasure ? 'Treasure' : 'Loot - 50%'})`);
    
    await supabase
      .from('items')
      .update({ status: 'sold' })
      .eq('id', item.id);
    
    setIncomingLoot(prev => prev.filter(i => i.id !== item.id));
    setMasterLog(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sold' } : i));
  };

  const handleAssignItem = async (item, player) => {
    await supabase
      .from('items')
      .update({
        status: 'assigned',
        assigned_to: player,
        original_value: item.value
      })
      .eq('id', item.id);

    const assignedItem = {
      id: item.id,
      name: item.name,
      value: item.value,
      originalValue: item.value,
      isTreasure: item.is_treasure,
      charges: item.charges,
      consumable: item.consumable || false,
      notes: item.notes || ''
    };

    setInventories(prev => ({
      ...prev,
      [player]: [...(prev[player] || []), assignedItem]
    }));

    setIncomingLoot(prev => prev.filter(i => i.id !== item.id));
    setMasterLog(prev => prev.map(i => i.id === item.id ? { ...i, status: 'assigned', assigned_to: player } : i));

    await addTransaction('assign', `${item.name} assigned to ${player}`, 0, player);

    setShowAssignModal(false);
    setSelectedItem(null);
  };

  const handleTransferItem = async (item, fromPlayer, toPlayer) => {
    // Update database
    await supabase
      .from('items')
      .update({ assigned_to: toPlayer })
      .eq('id', item.id);

    // Remove from source inventory
    setInventories(prev => ({
      ...prev,
      [fromPlayer]: prev[fromPlayer].filter(i => i.id !== item.id)
    }));

    // Add to destination inventory
    setInventories(prev => ({
      ...prev,
      [toPlayer]: [...(prev[toPlayer] || []), item]
    }));

    // Update master log
    setMasterLog(prev => prev.map(i => i.id === item.id ? { ...i, assigned_to: toPlayer } : i));

    // Add transaction
    await addTransaction('transfer', `${item.name} transferred from ${fromPlayer} to ${toPlayer}`, 0, `${fromPlayer} → ${toPlayer}`);

    setShowTransferModal(false);
    setSelectedItem(null);
    setTransferringFrom(null);
  };

  const handleSellFromInventory = async (player, item, splitToAll = true) => {
    const sellValue = item.isTreasure ? item.originalValue : Math.floor(item.originalValue * 0.5);

    if (splitToAll) {
      // Distribute to all players
      await distributeGold(sellValue, `${player} sold ${item.name} (split to all)`);
    } else {
      // Give gold only to the player who owns the item
      try {
        const { error } = await supabase
          .from('players')
          .update({ gold: gold[player] + sellValue })
          .eq('name', player)
          .eq('campaign_id', campaign.id);

        if (error) throw error;

        await reloadGold();
        await addTransaction('sell', `${player} sold ${item.name} (kept proceeds)`, sellValue, player);
      } catch (error) {
        alert(`Error selling item: ${error.message}`);
        await loadAllData();
        return;
      }
    }

    await supabase
      .from('items')
      .update({ status: 'sold' })
      .eq('id', item.id);

    setInventories(prev => ({
      ...prev,
      [player]: prev[player].filter(i => i.id !== item.id)
    }));

    setMasterLog(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sold' } : i));
  };

  const handleUseCharge = async (player, item, delta) => {
    const newCharges = Math.max(0, item.charges + delta);
    
    if (newCharges === 0) {
      // Remove from inventory, mark as depleted
      await supabase
        .from('items')
        .update({ status: 'depleted', charges: 0 })
        .eq('id', item.id);
      
      setInventories(prev => ({
        ...prev,
        [player]: prev[player].filter(i => i.id !== item.id)
      }));
      
      setMasterLog(prev => prev.map(i => i.id === item.id ? { ...i, status: 'depleted', charges: 0 } : i));
      await addTransaction('depleted', `${item.name} depleted (${player})`, 0, player);
    } else {
      // Update charges
      await supabase
        .from('items')
        .update({ charges: newCharges })
        .eq('id', item.id);
      
      setInventories(prev => ({
        ...prev,
        [player]: prev[player].map(i => i.id === item.id ? { ...i, charges: newCharges } : i)
      }));
      
      setMasterLog(prev => prev.map(i => i.id === item.id ? { ...i, charges: newCharges } : i));
    }
  };

  const handleBuyItem = async () => {
    if (!newItem.name || !newItem.value || !buyingPlayer) return;

    const cost = parseFloat(newItem.value);
    const goldKey = buyingPlayer === 'Party' ? 'Party Fund' : buyingPlayer;

    if (gold[goldKey] < cost) {
      alert('Not enough gold!');
      return;
    }

    try {
      // Insert item
      const { data: itemData, error } = await supabase
        .from('items')
        .insert([{
          campaign_id: campaign.id,
          name: newItem.name,
          value: cost,
          original_value: cost,
          is_treasure: newItem.isTreasure,
          charges: newItem.charges ? parseInt(newItem.charges) : null,
          consumable: newItem.consumable || false,
          notes: newItem.notes || '',
          status: 'purchased',
          assigned_to: buyingPlayer
        }])
        .select()
        .single();

      if (error) {
        console.error('Error buying item:', error);
        alert(`Error buying item: ${error.message}`);
        return;
      }

      // Update gold
      if (buyingPlayer === 'Party') {
        // Get party fund row and update it
        const { data: partyData, error: partyFetchError } = await supabase
          .from('party_fund')
          .select('id, gold')
          .eq('campaign_id', campaign.id)
          .single();

        if (partyFetchError) {
          console.error('Error fetching party fund:', partyFetchError);
          throw partyFetchError;
        }

        const { error: updateError } = await supabase
          .from('party_fund')
          .update({ gold: partyData.gold - cost })
          .eq('id', partyData.id);

        if (updateError) {
          console.error('Error updating party fund:', updateError);
          throw updateError;
        }
      } else {
        const { error: updateError } = await supabase
          .from('players')
          .update({ gold: gold[goldKey] - cost })
          .eq('name', buyingPlayer);

        if (updateError) {
          console.error('Error updating player gold:', updateError);
          throw updateError;
        }
      }

      const item = {
        id: itemData.id,
        name: itemData.name,
        value: itemData.value,
        originalValue: itemData.original_value,
        isTreasure: itemData.is_treasure,
        charges: itemData.charges,
        consumable: itemData.consumable,
        notes: itemData.notes || ''
      };

      setInventories(prev => ({
        ...prev,
        [buyingPlayer]: [...(prev[buyingPlayer] || []), item]
      }));

      // Reload gold from database to ensure sync
      await reloadGold();

      setMasterLog(prev => [itemData, ...prev]);
      await addTransaction('purchase', `${buyingPlayer} bought ${newItem.name}`, -cost, buyingPlayer);

      setNewItem({ name: '', value: '', isTreasure: false, charges: null, consumable: false, notes: '' });
      setShowBuyModal(false);
      setBuyingPlayer(null);
    } catch (error) {
      alert(`Error purchasing item: ${error.message}`);
      // Reload data to ensure UI matches database
      await loadAllData();
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    if (players.includes(newPlayerName.trim())) {
      alert('Player already exists!');
      return;
    }

    const playerName = newPlayerName.trim();

    const { error } = await supabase
      .from('players')
      .insert([{ campaign_id: campaign.id, name: playerName, gold: 0 }]);
    
    if (error) {
      alert('Error adding player');
      return;
    }
    
    setPlayers(prev => [...prev, playerName]);
    setInventories(prev => ({ ...prev, [playerName]: [] }));
    setGold(prev => ({ ...prev, [playerName]: 0 }));
    setNewPlayerName('');
    setShowPlayerModal(false);
  };

  const handleRemovePlayer = async (playerName) => {
    if (inventories[playerName]?.length > 0) {
      if (!confirm(`${playerName} still has items in inventory. Remove anyway?`)) {
        return;
      }
    }
    
    await supabase
      .from('players')
      .delete()
      .eq('name', playerName);
    
    setPlayers(prev => prev.filter(p => p !== playerName));
  };

const handleGoldEdit = async (entity, newValue) => {
  const value = parseInt(newValue);
  if (isNaN(value)) return;

  try {
    let oldValue = 0;

    if (entity === 'Party Fund') {
      // Get the party fund row first
      const { data: partyData, error: fetchError } = await supabase
        .from('party_fund')
        .select('id, gold')
        .eq('campaign_id', campaign.id)
        .single();

      if (fetchError) {
        console.error('Error fetching party fund:', fetchError);
        throw fetchError;
      }

      if (partyData) {
        oldValue = partyData.gold;
        const { error: updateError } = await supabase
          .from('party_fund')
          .update({ gold: value })
          .eq('id', partyData.id);

        if (updateError) {
          console.error('Error updating party fund:', updateError);
          throw updateError;
        }
      }
    } else {
      // Get current player gold from database
      const { data: playerData, error: fetchError } = await supabase
        .from('players')
        .select('gold')
        .eq('name', entity)
        .single();

      if (fetchError) {
        console.error('Error fetching player gold:', fetchError);
        throw fetchError;
      }

      oldValue = playerData.gold;
      const { error: updateError } = await supabase
        .from('players')
        .update({ gold: value })
        .eq('name', entity);

      if (updateError) {
        console.error('Error updating player gold:', updateError);
        throw updateError;
      }
    }

    // Reload gold from database to ensure sync
    await reloadGold();
    await addTransaction('manual', `Manual adjustment for ${entity}`, value - oldValue, entity);
    setEditingGold(null);
  } catch (error) {
    alert(`Error updating gold: ${error.message}`);
    // Reload data to ensure UI matches database
    await loadAllData();
    setEditingGold(null);
  }
  };

  const parseBulkImport = () => {
    const lines = bulkImportText.split('\n').filter(line => line.trim());
    const items = [];
    
    lines.forEach(line => {
      const match = line.match(/^\*?\s*(\d+)\s+(.+?)\s*=\s*([0-9.]+)\s*gp/i);
      
      if (match) {
        const quantity = parseInt(match[1]);
        const name = match[2].trim();
        const pricePerUnit = parseFloat(match[3]);
        const totalPrice = pricePerUnit * quantity;
        
        items.push({
          id: Date.now() + Math.random(),
          quantity,
          name,
          pricePerUnit,
          totalPrice,
          isTreasure: false,
          charges: null,
          consumable: false,
          notes: ''
        });
      }
    });
    
    setParsedBulkItems(items);
  };

  const updateParsedItem = (id, field, value) => {
    setParsedBulkItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const confirmBulkImport = async () => {
    const itemsToInsert = parsedBulkItems.map(parsed => ({
      campaign_id: campaign.id,
      name: parsed.quantity > 1 ? `${parsed.quantity}x ${parsed.name}` : parsed.name,
      value: parsed.totalPrice,
      is_treasure: parsed.isTreasure,
      charges: parsed.charges,
      consumable: parsed.consumable,
      notes: parsed.notes || '',
      status: 'incoming'
    }));

    const { data, error } = await supabase
      .from('items')
      .insert(itemsToInsert)
      .select();

    if (!error && data) {
      setIncomingLoot(prev => [...data, ...prev]);
      setMasterLog(prev => [...data, ...prev]);
    }

    setBulkImportText('');
    setParsedBulkItems([]);
    setShowBulkImportModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading {campaign.name}...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold mb-2">{campaign.name}</h1>
              <p className="text-sm md:text-base text-cyan-100">D20 TTRPG - Gold Distribution & Inventory</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onBackToCampaigns}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <ArrowLeft size={18} />
                Campaigns
              </button>
              <button
                onClick={onLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveView('loot')}
            className={`px-4 md:px-6 py-3 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-all text-sm md:text-base ${
              activeView === 'loot' ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <Package size={20} />
            Incoming Loot
          </button>
          <button
            onClick={() => setActiveView('inventories')}
            className={`px-4 md:px-6 py-3 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-all text-sm md:text-base ${
              activeView === 'inventories' ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <Package size={20} />
            Inventories
          </button>
          <button
            onClick={() => setActiveView('gold')}
            className={`px-4 md:px-6 py-3 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-all text-sm md:text-base ${
              activeView === 'gold' ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <Coins size={20} />
            Gold
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`px-4 md:px-6 py-3 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-all text-sm md:text-base ${
              activeView === 'history' ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <History size={20} />
            Log
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className={`px-4 md:px-6 py-3 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-all text-sm md:text-base ${
              activeView === 'settings' ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <Settings size={20} />
            Settings
          </button>
        </div>

        {/* Incoming Loot View */}
        {activeView === 'loot' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <h2 className="text-xl sm:text-2xl font-bold">Unprocessed Loot</h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowBulkImportModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FileText size={20} />
                  Bulk Import
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus size={20} />
                  Add Item
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {incomingLoot.map(item => (
                <div key={item.id} className="bg-slate-800 rounded-lg p-6 shadow-xl border border-slate-700">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{item.name}</h3>
                      <div className="flex gap-3 mt-2 text-sm flex-wrap">
                        <span className="text-cyan-400 font-semibold">{item.value} gp</span>
                        <span className={`px-2 py-1 rounded ${item.is_treasure ? 'bg-purple-600' : 'bg-blue-600'}`}>
                          {item.is_treasure ? 'Treasure' : 'Loot (50% sell)'}
                        </span>
                        {item.charges && (
                          <span className="px-2 py-1 rounded bg-green-600">
                            {item.charges} charges
                          </span>
                        )}
                        {item.consumable && (
                          <span className="px-2 py-1 rounded bg-purple-500">
                            Consumable
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="mt-2 text-sm text-slate-300 italic">
                          {item.notes}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from('items').delete().eq('id', item.id);
                        setIncomingLoot(prev => prev.filter(i => i.id !== item.id));
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={() => handleSellItem(item)}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
                    >
                      Sell ({item.is_treasure ? item.value : Math.floor(item.value * 0.5)} gp ÷ {players.length + 1})
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setShowAssignModal(true);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
                    >
                      Assign to Player
                    </button>
                  </div>
                </div>
              ))}

              {incomingLoot.length === 0 && (
                <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-400 border border-slate-700">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No loot to process. Add items as you find them!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inventories View */}
        {activeView === 'inventories' && (
          <div>
            {/* Inventory Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {[...players, 'Party'].map(entity => (
                <button
                  key={entity}
                  onClick={() => setActiveInventory(entity)}
                  className={`px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-all ${
                    activeInventory === entity ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  {entity}
                </button>
              ))}
              <button
                onClick={() => setActiveInventory('Consumables')}
                className={`px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-all ${
                  activeInventory === 'Consumables' ? 'bg-cyan-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                Consumables
              </button>
            </div>

            {/* Current Inventory */}
            {activeInventory !== 'Consumables' && (
              <div className="bg-slate-800 rounded-lg p-6 shadow-xl border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">{activeInventory}</h3>
                  <div className="text-cyan-400 font-bold text-xl">
                    {gold[activeInventory] || gold['Party Fund']} gp
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {inventories[activeInventory]?.map(item => (
                    <div key={item.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-lg">{item.name}</div>
                          <div className="text-sm text-slate-300 mt-1 flex gap-2 items-center flex-wrap">
                            <span>{item.originalValue} gp {item.isTreasure ? '(Treasure)' : '(Loot)'}</span>
                            {item.consumable && (
                              <span className="px-2 py-0.5 rounded bg-purple-600 text-xs">Consumable</span>
                            )}
                          </div>
                          {item.notes && (
                            <div className="text-xs text-slate-400 mt-1 italic">
                              {item.notes}
                            </div>
                          )}
                        </div>
                        {item.charges !== null && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUseCharge(activeInventory, item, -1)}
                              className="bg-red-500 hover:bg-red-600 p-1 rounded transition-colors"
                            >
                              <MinusCircle size={18} />
                            </button>
                            <span className="font-mono font-bold w-10 text-center text-lg">{item.charges}</span>
                            <button
                              onClick={() => handleUseCharge(activeInventory, item, 1)}
                              className="bg-green-500 hover:bg-green-600 p-1 rounded transition-colors"
                            >
                              <PlusCircle size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setSellingFrom(activeInventory);
                            setShowSellModal(true);
                          }}
                          className="flex-1 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <Coins size={16} />
                          Sell for {item.isTreasure ? item.originalValue : Math.floor(item.originalValue * 0.5)} gp
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setTransferringFrom(activeInventory);
                            setShowTransferModal(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition-colors inline-flex items-center gap-2"
                        >
                          <ArrowRightLeft size={16} />
                          Transfer
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!inventories[activeInventory] || inventories[activeInventory].length === 0) && (
                    <div className="text-center text-slate-400 py-8">Empty inventory</div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setBuyingPlayer(activeInventory);
                    setShowBuyModal(true);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={18} />
                  Buy Item for {activeInventory}
                </button>
              </div>
            )}

            {/* Consumables View */}
            {activeInventory === 'Consumables' && (
              <div className="space-y-6">
                {[...players, 'Party'].map(owner => {
                  const consumables = inventories[owner]?.filter(item => item.consumable && item.charges !== null) || [];
                  if (consumables.length === 0) return null;
                  
                  return (
                    <div key={owner} className="bg-slate-800 rounded-lg p-6 shadow-xl border border-slate-700">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">{owner}'s Consumables</h3>
                        <div className="text-cyan-400 font-bold">{gold[owner] || gold['Party Fund']} gp</div>
                      </div>
                      
                      <div className="space-y-3">
                        {consumables.map(item => (
                          <div key={item.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-semibold">{item.name}</div>
                                <div className="text-sm text-slate-300 mt-1">{item.originalValue} gp</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleUseCharge(owner, item, -1)}
                                  className="bg-red-500 hover:bg-red-600 p-2 rounded transition-colors"
                                >
                                  <MinusCircle size={20} />
                                </button>
                                <span className="font-mono font-bold w-12 text-center text-xl">{item.charges}</span>
                                <button
                                  onClick={() => handleUseCharge(owner, item, 1)}
                                  className="bg-green-500 hover:bg-green-600 p-2 rounded transition-colors"
                                >
                                  <PlusCircle size={20} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {[...players, 'Party'].every(owner => 
                  (inventories[owner]?.filter(item => item.consumable && item.charges !== null) || []).length === 0
                ) && (
                  <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-400 border border-slate-700">
                    <Package size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No consumable items. Mark items as "Consumable" when adding them!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gold Tracking View */}
        {activeView === 'gold' && (
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold">Current Gold</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(gold).map(([entity, amount]) => (
                <div key={entity} className="bg-slate-800 rounded-lg p-6 shadow-xl border border-slate-700">
                  <div className="text-slate-300 mb-2">{entity}</div>
                  {editingGold === entity ? (
                    <input
                      type="number"
                      defaultValue={amount}
                      autoFocus
                      onBlur={(e) => handleGoldEdit(entity, e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleGoldEdit(entity, e.target.value);
                        }
                      }}
                      className="text-3xl font-bold text-cyan-400 bg-slate-700 rounded px-2 py-1 w-full"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingGold(entity)}
                      className="text-3xl font-bold text-cyan-400 cursor-pointer hover:text-cyan-300 flex items-center gap-2"
                    >
                      {amount} gp
                      <Edit2 size={20} className="text-slate-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h2 className="text-2xl font-bold mt-8">Recent Transactions</h2>
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="bg-slate-800 rounded-lg p-4 flex justify-between items-center border border-slate-700">
                  <div>
                    <div className="font-medium">{tx.description}</div>
                    <div className="text-sm text-slate-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className={`font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} gp
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Master Log View */}
        {activeView === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold">Master Item Log</h2>
            <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 overflow-x-auto">
              <table className="w-full text-sm sm:text-base">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm">Item</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm">Status</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm hidden sm:table-cell">Assigned To</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm hidden md:table-cell">Charges</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {masterLog.map(item => (
                    <tr key={item.id} className="hover:bg-slate-750">
                      <td className="px-2 sm:px-4 py-2 sm:py-3">{item.name}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${
                          item.status === 'sold' ? 'bg-cyan-600' :
                          item.status === 'assigned' ? 'bg-blue-600' :
                          item.status === 'depleted' ? 'bg-red-600' :
                          item.status === 'purchased' ? 'bg-green-600' :
                          'bg-slate-600'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">{item.assigned_to || '—'}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">{item.charges !== null ? item.charges : '—'}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-400 italic hidden lg:table-cell">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeView === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Campaign Settings</h2>

            {/* Party Fund Toggle */}
            <div className="bg-slate-800 rounded-lg p-6 shadow-xl border border-slate-700">
              <h3 className="text-xl font-bold mb-4">Gold Distribution</h3>
              <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-1">Party Fund Gets a Share</div>
                  <div className="text-sm text-slate-400">
                    {partyFundGetsShare
                      ? `Gold is split ${players.length + 1} ways (${players.length} players + Party Fund)`
                      : `Gold is split ${players.length} ways (${players.length} players only)`}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={partyFundGetsShare}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setPartyFundGetsShare(newValue);
                      try {
                        const { error } = await supabase
                          .from('campaigns')
                          .update({ party_fund_gets_share: newValue })
                          .eq('id', campaign.id);
                        if (error) throw error;
                      } catch (error) {
                        console.error('Error updating setting:', error);
                        alert('Error updating setting');
                        setPartyFundGetsShare(!newValue);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 shadow-xl border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Party Members</h3>
                <button
                  onClick={() => setShowPlayerModal(true)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <UserPlus size={18} />
                  Add Player
                </button>
              </div>

              <div className="text-sm text-slate-400 mb-4">
                Current split: {partyFundGetsShare ? `${players.length + 1} ways` : `${players.length} ways`}
              </div>

              <div className="space-y-3">
                {players.map(player => (
                  <div key={player} className="bg-slate-700 rounded-lg p-4 flex justify-between items-center border border-slate-600">
                    <div>
                      <div className="font-semibold">{player}</div>
                      <div className="text-sm text-slate-400">
                        {gold[player]} gp • {inventories[player]?.length || 0} items
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePlayer(player)}
                      className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                      <UserMinus size={18} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
                <div className="font-semibold mb-2">Party Fund</div>
                <div className="text-sm text-slate-400">
                  {gold['Party Fund']} gp • {inventories['Party']?.length || 0} items
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals - Same as before but with async handlers */}
      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Add New Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Item Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="e.g., Longsword +1"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Value (gp)</label>
                <input
                  type="number"
                  value={newItem.value}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="2315"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Charges (optional)</label>
                <input
                  type="number"
                  value={newItem.charges || ''}
                  onChange={(e) => setNewItem({ ...newItem, charges: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="Leave empty if no charges"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Notes (optional)</label>
                <textarea
                  value={newItem.notes || ''}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="e.g., Found in the captain's quarters"
                  rows="2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.isTreasure}
                  onChange={(e) => setNewItem({ ...newItem, isTreasure: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Treasure (sells at full value, not 50%)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.consumable}
                  onChange={(e) => setNewItem({ ...newItem, consumable: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Consumable (appears in Consumables tab)</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Player Modal */}
      {showAssignModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Assign {selectedItem.name}</h3>
            <div className="space-y-2">
              {[...players, 'Party'].map(player => (
                <button
                  key={player}
                  onClick={() => handleAssignItem(selectedItem, player)}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded transition-colors text-left"
                >
                  {player} ({gold[player] || gold['Party Fund']} gp)
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowAssignModal(false);
                setSelectedItem(null);
              }}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transfer Item Modal */}
      {showTransferModal && selectedItem && transferringFrom && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Transfer {selectedItem.name}</h3>
            <div className="mb-4 text-sm text-slate-300">
              From: <span className="text-cyan-400 font-semibold">{transferringFrom}</span>
            </div>
            <div className="mb-2 text-sm font-semibold">Transfer to:</div>
            <div className="space-y-2">
              {[...players, 'Party'].filter(player => player !== transferringFrom).map(player => (
                <button
                  key={player}
                  onClick={() => handleTransferItem(selectedItem, transferringFrom, player)}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded transition-colors text-left"
                >
                  {player} ({gold[player] || gold['Party Fund']} gp)
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowTransferModal(false);
                setSelectedItem(null);
                setTransferringFrom(null);
              }}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sell Item Modal */}
      {showSellModal && selectedItem && sellingFrom && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Sell {selectedItem.name}</h3>
            <div className="mb-4 text-sm text-slate-300">
              From: <span className="text-cyan-400 font-semibold">{sellingFrom}</span>
              <br />
              Sell Value: <span className="text-green-400 font-bold">
                {selectedItem.isTreasure ? selectedItem.originalValue : Math.floor(selectedItem.originalValue * 0.5)} gp
              </span>
            </div>
            <div className="mb-4 text-sm text-slate-400">
              Choose how to distribute the gold:
            </div>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  await handleSellFromInventory(sellingFrom, selectedItem, true);
                  setShowSellModal(false);
                  setSelectedItem(null);
                  setSellingFrom(null);
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 px-4 py-3 rounded transition-colors text-left"
              >
                <div className="font-semibold">Sell for {selectedItem.isTreasure ? selectedItem.originalValue : Math.floor(selectedItem.originalValue * 0.5)} gp (Split to All)</div>
                <div className="text-sm text-cyan-100">
                  Each player {partyFundGetsShare ? 'and party fund' : ''} gets{' '}
                  {Math.floor((selectedItem.isTreasure ? selectedItem.originalValue : Math.floor(selectedItem.originalValue * 0.5)) / (partyFundGetsShare ? players.length + 1 : players.length))} gp
                </div>
              </button>
              <button
                onClick={async () => {
                  await handleSellFromInventory(sellingFrom, selectedItem, false);
                  setShowSellModal(false);
                  setSelectedItem(null);
                  setSellingFrom(null);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded transition-colors text-left"
              >
                <div className="font-semibold">Sell for {selectedItem.isTreasure ? selectedItem.originalValue : Math.floor(selectedItem.originalValue * 0.5)} gp ({sellingFrom} Only)</div>
                <div className="text-sm text-blue-100">
                  {sellingFrom} keeps all {selectedItem.isTreasure ? selectedItem.originalValue : Math.floor(selectedItem.originalValue * 0.5)} gp
                </div>
              </button>
            </div>
            <button
              onClick={() => {
                setShowSellModal(false);
                setSelectedItem(null);
                setSellingFrom(null);
              }}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Buy Item Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Buy Item for {buyingPlayer}</h3>
            <div className="mb-4 text-sm text-slate-300">
              Current gold: <span className="text-cyan-400 font-bold">{gold[buyingPlayer] || gold['Party Fund']} gp</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Item Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="e.g., Rope (50 ft)"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Cost (gp)</label>
                <input
                  type="number"
                  value={newItem.value}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Charges (optional)</label>
                <input
                  type="number"
                  value={newItem.charges || ''}
                  onChange={(e) => setNewItem({ ...newItem, charges: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="Leave empty if no charges"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Notes (optional)</label>
                <textarea
                  value={newItem.notes || ''}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="e.g., Purchased in Port Peril"
                  rows="2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.isTreasure}
                  onChange={(e) => setNewItem({ ...newItem, isTreasure: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Treasure (can sell at full value later)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.consumable}
                  onChange={(e) => setNewItem({ ...newItem, consumable: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Consumable (appears in Consumables tab)</label>
              </div>
              <div className="text-sm text-slate-400">
                Note: Items can be sold later at {newItem.isTreasure ? '100%' : '50%'} value
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBuyModal(false);
                  setBuyingPlayer(null);
                  setNewItem({ name: '', value: '', isTreasure: false, charges: null, consumable: false, notes: '' });
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyItem}
                className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
              >
                Buy Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Add New Player</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Player Name</label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddPlayer();
                    }
                  }}
                  className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600"
                  placeholder="e.g., Torvin"
                  autoFocus
                />
              </div>
              <div className="text-sm text-slate-400">
                New player starts with 0 gp and empty inventory
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPlayerModal(false);
                  setNewPlayerName('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full border border-slate-700 my-8">
            <h3 className="text-xl font-bold mb-4">Bulk Import Loot</h3>
            
            {parsedBulkItems.length === 0 ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm mb-2">Paste your loot list:</label>
                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    className="w-full bg-slate-700 rounded px-4 py-2 text-white border border-slate-600 font-mono text-sm h-64"
                    placeholder="* 4 mwk breastplate = 700 gp&#10;* 4 dagger = 4 gp&#10;* 1 spellbook = 7.5 gp&#10;&#10;Format: * [quantity] [item name] = [price per unit] gp"
                  />
                </div>
                <div className="text-sm text-slate-400 mb-4">
                  <div className="font-semibold mb-2">Format examples:</div>
                  <div className="bg-slate-900 rounded p-3 font-mono text-xs space-y-1">
                    <div>* 4 mwk breastplate = 700 gp</div>
                    <div>* 10 crossbow bolts = 0.5 gp</div>
                    <div>* 1 spellbook = 7.5 gp</div>
                  </div>
                  <div className="mt-2">Price should be <strong>per unit</strong>. We'll multiply by quantity automatically.</div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowBulkImportModal(false);
                      setBulkImportText('');
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={parseBulkImport}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                  >
                    Parse Items
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 text-sm text-slate-300">
                  Found {parsedBulkItems.length} items. Review and configure:
                </div>
                <div className="bg-slate-900 rounded-lg overflow-x-auto mb-4 max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-slate-950 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs">Qty</th>
                        <th className="px-3 py-2 text-left text-xs">Item Name</th>
                        <th className="px-3 py-2 text-left text-xs">Price/Unit</th>
                        <th className="px-3 py-2 text-left text-xs">Total</th>
                        <th className="px-3 py-2 text-left text-xs">Treasure</th>
                        <th className="px-3 py-2 text-left text-xs">Consumable</th>
                        <th className="px-3 py-2 text-left text-xs">Charges</th>
                        <th className="px-3 py-2 text-left text-xs">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {parsedBulkItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm">{item.quantity}</td>
                          <td className="px-3 py-2 text-sm font-medium">{item.name}</td>
                          <td className="px-3 py-2 text-sm text-cyan-400">{item.pricePerUnit} gp</td>
                          <td className="px-3 py-2 text-sm font-bold text-cyan-300">{item.totalPrice} gp</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={item.isTreasure}
                              onChange={(e) => updateParsedItem(item.id, 'isTreasure', e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={item.consumable}
                              onChange={(e) => updateParsedItem(item.id, 'consumable', e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.charges || ''}
                              onChange={(e) => updateParsedItem(item.id, 'charges', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-16 bg-slate-800 rounded px-2 py-1 text-sm border border-slate-600"
                              placeholder="—"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => updateParsedItem(item.id, 'notes', e.target.value)}
                              className="w-32 bg-slate-800 rounded px-2 py-1 text-sm border border-slate-600"
                              placeholder="Optional"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setParsedBulkItems([]);
                      setBulkImportText('');
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkImportModal(false);
                      setParsedBulkItems([]);
                      setBulkImportText('');
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkImport}
                    className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
                  >
                    Import {parsedBulkItems.length} Items
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;