'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { createClient as createRawClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';

type WizardStep = 'settings' | 'players' | 'preview';

interface Player {
    id: string;
    full_name: string;
    fargo_rating: number;
    nickname?: string;
    player_number?: number;
    isGuest?: boolean; // Flag for guest players
}

export default function CreateTournamentPage() {
    const router = useRouter();
    const supabase = createClient();
    const [step, setStep] = useState<WizardStep>('settings');
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [gameType, setGameType] = useState<'8ball' | '9ball'>('8ball');
    const [tableCount, setTableCount] = useState(4);
    const [tableNames, setTableNames] = useState<string[]>([]); // To be populated based on count

    // Settings State
    const [isHandicapped, setIsHandicapped] = useState(false);
    const [isRated, setIsRated] = useState(false); // New Rated State
    const [entryFee, setEntryFee] = useState<number>(0);
    const [greenFee, setGreenFee] = useState<number>(0);
    const [moneyAdded, setMoneyAdded] = useState<number>(0);

    // Players State
    const [players, setPlayers] = useState<Player[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'name' | 'number'>('name');
    const [searchResults, setSearchResults] = useState<Player[]>([]);
    const [searching, setSearching] = useState(false);

    // Guest Player State
    // const [showGuestForm, setShowGuestForm] = useState(false); // Removed
    const [guestName, setGuestName] = useState('');
    const [guestFargo, setGuestFargo] = useState<string>(''); // String to handle empty state gracefully

    const generateTableNames = (count: number) => {
        return Array.from({ length: count }, (_, i) => `Table ${i + 1}`);
    };

    const handleNext = () => {
        if (step === 'settings') {
            if (!name.trim()) return alert('Please enter a tournament name');

            // Ensure tableNames is fully populated up to tableCount
            const currentNames = [...tableNames];
            if (currentNames.length < tableCount) {
                for (let i = currentNames.length; i < tableCount; i++) {
                    currentNames.push(`Table ${i + 1}`);
                }
                setTableNames(currentNames);
            }

            setStep('players');
        } else if (step === 'players') {
            if (players.length < 2) return alert('At least 2 players are required');
            setStep('preview');
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        let queryBuilder = supabase
            .from('profiles')
            .select('id, full_name, fargo_rating, nickname, player_number');

        if (searchMode === 'name') {
            queryBuilder = queryBuilder.or(`full_name.ilike.%${query}%,nickname.ilike.%${query}%`);
        } else {
            // Filter by text representation of player_number for partial matching
            queryBuilder = queryBuilder.filter('player_number::text', 'ilike', `%${query}%`);
        }

        const { data, error } = await queryBuilder.limit(5);

        if (data) setSearchResults(data);
        setSearching(false);
    };

    const addPlayer = (player: Player) => {
        if (players.find(p => p.id === player.id)) return;
        setPlayers([...players, player]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const addGuestPlayer = () => {
        if (!guestName.trim()) return alert('Please enter a guest name');
        const rating = parseInt(guestFargo) || 500; // Default to 500 if invalid/empty

        const guest: Player = {
            id: `guest-${Date.now()}`, // Temporary ID for frontend key
            full_name: guestName,
            fargo_rating: rating,
            isGuest: true,
            nickname: 'Guest'
        };

        setPlayers([...players, guest]);
        setGuestName('');
        setGuestFargo('');
    };

    const removePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
    };

    const { userId, getToken } = useAuth(); // Clerk Auth

    const createTournament = async () => {
        if (!userId) return; // Should likely redirect or show error if no user
        setLoading(true);

        try {
            // Get Clerk Token for Supabase RLS
            const token = await getToken({ template: 'supabase' });

            if (!token) {
                console.error("Authentication Error: No Clerk Token found.");
                throw new Error("Missing authentication token");
            }

            // Create authenticated client (Vanilla JS to force headers)
            const supabase = createRawClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    global: {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                }
            );

            // 1. Create Tournament
            const { data: tournament, error: tError } = await supabase
                .from('tournaments')
                .insert({
                    name,
                    game_type: gameType,
                    table_config: tableNames,
                    organizer_id: userId, // Use Clerk User ID
                    is_handicapped: isHandicapped,
                    is_rated: isRated, // Insert Rated Flag
                    entry_fee: entryFee,
                    green_fee: greenFee,
                    money_added: moneyAdded
                })
                .select()
                .single();

            if (tError) throw tError;

            // 2. Add Participants
            const participantsData = players.map((p, index) => ({
                tournament_id: tournament.id,
                player_id: p.isGuest ? null : p.id, // NULL for guests
                guest_name: p.isGuest ? p.full_name : null, // Set Name for guests
                fargo_rating_snapshot: p.fargo_rating,
                seed: index + 1
            }));

            const { data: participants, error: pError } = await supabase
                .from('tournament_participants')
                .insert(participantsData)
                .select();

            if (pError) throw pError;

            // 3. Generate Bracket (First Round)
            // We need to import the generator dynamically or move it to an API route usually, 
            // but since we are client-side and supabase client is available, let's try calling it.
            // Note: In Next.js App Router, it's cleaner to do this via a Server Action or API. 
            // For now, let's inline a simple fetch to a new API route OR (easier) just logic here.
            // Since we created 'src/utils/bracket-generator.ts' which imports SupabaseClient, 
            // we can fetch the participants with their participant IDs first (which we just did).

            // We need to pass the participants with their profile IDs.
            // The 'participants' const above has the inserted rows.
            await import('@/utils/bracket-generator').then(async (mod) => {
                await mod.generateBracket(supabase, tournament.id, participants as any[]);
            });

            // Redirect
            router.push(`/dashboard/tournaments/${tournament.id}`);

        } catch (error: any) {
            alert('Error creating tournament: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-2xl py-12 pb-24">

            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.back()}
                    className="text-sm mb-4 font-bold flex items-center gap-2 transition-colors hover:brightness-110"
                    style={{ color: '#D4AF37' }}
                >
                    &larr; Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold text-white">Create Tournament</h1>
            </div>

            <div className="card-glass p-8">
                {/* Step 1: Settings */}
                {step === 'settings' && (
                    <div className="flex flex-col gap-8">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Tournament Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-surface border border-border rounded p-3 text-white focus:border-[#D4AF37] outline-none transition-colors"
                                placeholder="e.g. Saturday 8-Ball Open"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Game Type</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setGameType('8ball')}
                                    className={`p-4 rounded border font-bold transition-all duration-200 flex flex-col items-center gap-2 ${gameType === '8ball'
                                        ? 'bg-black/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                                        : 'bg-surface border-border text-gray-400 hover:border-gray-500 hover:bg-surface-hover'}`}
                                    style={gameType === '8ball' ? { borderColor: '#D4AF37', color: '#D4AF37' } : { color: '#9CA3AF' }}
                                >
                                    {/* 8-Ball Icon: CSS Circle */}
                                    <div
                                        className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-sm transition-all duration-300 flex-shrink-0"
                                        style={{
                                            boxShadow: gameType === '8ball'
                                                ? '0 0 15px #D4AF37'
                                                : '0 0 10px rgba(156, 163, 175, 0.4)'
                                        }}
                                    >
                                        <div
                                            className="bg-white flex-none"
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                minWidth: '16px',
                                                minHeight: '16px',
                                                display: 'grid',
                                                placeItems: 'center',
                                                borderRadius: '50%',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <span className="text-black font-bold text-[8px] leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>8</span>
                                        </div>
                                    </div>
                                    <span>8-Ball</span>
                                </button>
                                <button
                                    onClick={() => setGameType('9ball')}
                                    className={`p-4 rounded border font-bold transition-all duration-200 flex flex-col items-center gap-2 ${gameType === '9ball'
                                        ? 'bg-black/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                                        : 'bg-surface border-border text-gray-400 hover:border-gray-500 hover:bg-surface-hover'}`}
                                    style={gameType === '9ball' ? { borderColor: '#D4AF37', color: '#D4AF37' } : { color: '#9CA3AF' }}
                                >
                                    {/* 9-Ball Icon: Realistic Vertical Stripe */}
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm overflow-hidden transition-all duration-300 flex-shrink-0"
                                        style={{
                                            background: 'linear-gradient(180deg, white 0%, white 15%, #fbbf24 15%, #fbbf24 85%, white 85%, white 100%)',
                                            boxShadow: gameType === '9ball'
                                                ? '0 0 15px #D4AF37'
                                                : '0 0 10px rgba(156, 163, 175, 0.4)'
                                        }}
                                    >
                                        <div
                                            className="bg-white flex-none"
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                minWidth: '16px',
                                                minHeight: '16px',
                                                display: 'grid',
                                                placeItems: 'center',
                                                borderRadius: '50%',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <span className="text-black font-bold text-[8px] leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>9</span>
                                        </div>
                                    </div>
                                    <span>9-Ball</span>
                                </button>
                            </div>
                        </div>


                        {/* Tournament Settings Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Handicap Toggle */}
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">Tournament Mode</label>
                                <div className="flex bg-surface border border-border rounded p-1 gap-1">
                                    <button
                                        onClick={() => setIsHandicapped(false)}
                                        className="flex-1 py-2 text-sm font-bold rounded transition-colors"
                                        style={{
                                            backgroundColor: !isHandicapped ? '#D4AF37' : 'rgba(31, 41, 55, 0.5)', // Gold vs Gray-800/50
                                            color: !isHandicapped ? '#000000' : '#9CA3AF', // Black vs Gray-400
                                            boxShadow: !isHandicapped ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
                                        }}
                                    >
                                        Open (No Handicap)
                                    </button>
                                    <button
                                        onClick={() => setIsHandicapped(true)}
                                        className="flex-1 py-2 text-sm font-bold rounded transition-colors"
                                        style={{
                                            backgroundColor: isHandicapped ? '#D4AF37' : 'rgba(31, 41, 55, 0.5)',
                                            color: isHandicapped ? '#000000' : '#9CA3AF',
                                            boxShadow: isHandicapped ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
                                        }}
                                    >
                                        Handicapped
                                    </button>
                                </div>
                            </div>

                            {/* Number of Tables */}
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">Number of Tables</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={tableCount}
                                    onChange={e => {
                                        const count = Math.max(1, Math.min(50, Number(e.target.value)));
                                        setTableCount(count);
                                        // Update table names array: keep existing, add new if growing, slice if removing
                                        setTableNames(prev => {
                                            const newNames = [...prev];
                                            if (count > prev.length) {
                                                for (let i = prev.length; i < count; i++) {
                                                    newNames.push(`Table ${i + 1}`);
                                                }
                                            } else {
                                                newNames.length = count;
                                            }
                                            return newNames;
                                        });
                                    }}
                                    className="w-full bg-surface border border-border rounded p-3 text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>

                            {/* Rated Toggle */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-300 mb-2">
                                    Breakpoint Rated Event
                                    <span className="ml-2 text-xs text-gray-500 font-normal">(Affects Player Ratings)</span>
                                </label>
                                <div className="flex bg-surface border border-border rounded p-1 gap-1">
                                    <button
                                        onClick={() => setIsRated(false)}
                                        className="flex-1 py-2 text-sm font-bold rounded transition-colors"
                                        style={{
                                            backgroundColor: !isRated ? '#ef4444' : 'rgba(31, 41, 55, 0.5)', // Red vs Gray
                                            color: !isRated ? 'white' : '#9CA3AF',
                                            boxShadow: !isRated ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
                                        }}
                                    >
                                        Not Rated
                                    </button>
                                    <button
                                        onClick={() => setIsRated(true)}
                                        className="flex-1 py-2 text-sm font-bold rounded transition-colors"
                                        style={{
                                            backgroundColor: isRated ? '#22c55e' : 'rgba(31, 41, 55, 0.5)', // Green vs Gray
                                            color: isRated ? 'white' : '#9CA3AF',
                                            boxShadow: isRated ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
                                        }}
                                    >
                                        Breakpoint Rated
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Financials Section */}
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Financials</label>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 uppercase">Entry Fee</label>
                                    <div className="relative">
                                        <span
                                            className="absolute left-3 top-3 font-bold"
                                            style={{ color: '#22c55e' }}
                                        >$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={entryFee}
                                            onChange={e => setEntryFee(Number(e.target.value))}
                                            className="w-full bg-surface border border-border rounded p-3 text-white focus:border-[#D4AF37] outline-none"
                                            style={{ fontWeight: 'bold', paddingLeft: '24px' }}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 uppercase">Green Fee</label>
                                    <div className="relative">
                                        <span
                                            className="absolute left-3 top-3 font-bold"
                                            style={{ color: '#22c55e' }}
                                        >$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={greenFee}
                                            onChange={e => setGreenFee(Number(e.target.value))}
                                            className="w-full bg-surface border border-border rounded p-3 text-white focus:border-[#D4AF37] outline-none"
                                            style={{ fontWeight: 'bold', paddingLeft: '24px' }}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 uppercase">Money Added</label>
                                    <div className="relative">
                                        <span
                                            className="absolute left-3 top-3 font-bold"
                                            style={{ color: '#22c55e' }}
                                        >$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={moneyAdded}
                                            onChange={e => setMoneyAdded(Number(e.target.value))}
                                            className="w-full bg-surface border border-border rounded p-3 text-white focus:border-[#D4AF37] outline-none"
                                            style={{ fontWeight: 'bold', paddingLeft: '24px' }}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Table Names Inputs */}
                        <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {Array.from({ length: tableCount }).map((_, i) => (
                                <div key={i}>
                                    <label className="block text-xs text-gray-400 mb-1">Table {i + 1} Name</label>
                                    <input
                                        type="text"
                                        value={tableNames[i] || `Table ${i + 1}`}
                                        onChange={e => {
                                            const newNames = [...tableNames];
                                            // Ensure array is filled up to this index if it wasn't already (safety)
                                            while (newNames.length <= i) newNames.push(`Table ${newNames.length + 1}`);
                                            newNames[i] = e.target.value;
                                            setTableNames(newNames);
                                        }}
                                        className="w-full bg-surface/50 border border-border rounded p-2 text-sm text-white focus:border-[#D4AF37] outline-none"
                                    />
                                </div>
                            ))}
                        </div>

                        <button onClick={handleNext} className="w-full btn btn-primary mt-4">
                            Next: Add Players
                        </button>
                    </div>
                )}

                {/* Step 2: Players */}
                {step === 'players' && (
                    <div>
                        <div className="mb-12 relative">
                            <div className="flex items-center gap-4 mb-2">
                                <label className="block text-sm font-bold text-gray-300">Find Player</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSearchMode('name')}
                                        className="text-xs font-bold transition-colors"
                                        style={{ color: searchMode === 'name' ? '#D4AF37' : '#6b7280' }}
                                    >
                                        Name
                                    </button>
                                    <button
                                        onClick={() => setSearchMode('number')}
                                        className="text-xs font-bold transition-colors"
                                        style={{ color: searchMode === 'number' ? '#D4AF37' : '#6b7280' }}
                                    >
                                        #
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    className="flex-1 bg-surface border border-border rounded p-3 text-white focus:border-[#D4AF37] outline-none"
                                    placeholder={searchMode === 'name' ? "Search by name..." : "Search by player number..."}
                                />
                                <button className="bg-surface border border-border rounded p-3 text-white w-12 flex items-center justify-center">
                                    📷
                                </button>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-black border border-border rounded-b mt-1 z-10 shadow-xl">
                                    {searchResults.map(player => (
                                        <button
                                            key={player.id}
                                            onClick={() => addPlayer(player)}
                                            className="w-full text-left p-3 hover:bg-surface-hover flex justify-between items-center border-b border-border/50 last:border-0"
                                        >
                                            <div>
                                                <div className="font-bold text-white">
                                                    {player.full_name}
                                                    {player.player_number && <span className="ml-2 text-[#D4AF37] text-xs">#{player.player_number}</span>}
                                                </div>
                                                <div className="text-xs text-gray-400">{player.nickname}</div>
                                            </div>
                                            <div className="font-mono font-bold text-[#D4AF37]">{player.fargo_rating}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Guest Player Toggle */}
                        {/* Guest Player Section */}
                        <div className="mb-8 border-t border-border pt-6">
                            <h4 className="text-sm font-bold text-[#D4AF37] mb-4">Add Guest Player (Non-Member)</h4>
                            <div className="bg-surface/50 border border-border p-4 rounded">
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={guestName}
                                            onChange={e => setGuestName(e.target.value)}
                                            className="w-full bg-black/50 border border-border rounded p-2 text-white text-sm focus:border-[#D4AF37] outline-none"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-xs text-gray-400 mb-1">Fargo</label>
                                        <input
                                            type="number"
                                            value={guestFargo}
                                            onChange={e => setGuestFargo(e.target.value)}
                                            className="w-full bg-black/50 border border-border rounded p-2 text-white text-sm focus:border-[#D4AF37] outline-none"
                                            placeholder="500"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={addGuestPlayer}
                                    disabled={!guestName.trim()}
                                    className="w-full btn bg-[#D4AF37] text-black hover:bg-[#b8962e] py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    style={{ backgroundColor: !guestName.trim() ? 'rgba(212, 175, 55, 0.2)' : '#D4AF37', color: !guestName.trim() ? '#6b7280' : 'black' }}
                                >
                                    Add Guest
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            <h3 className="text-sm font-bold text-gray-400">Participants ({players.length})</h3>
                            {players.length === 0 && (
                                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded">
                                    No players added yet.
                                </div>
                            )}
                            {players.map((p, i) => (
                                <div key={p.id} className="flex justify-between items-center bg-surface/50 p-3 rounded">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-500 font-mono w-6">{i + 1}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium">
                                                {p.full_name}
                                                {p.nickname && <span className="text-gray-400 font-normal ml-1">("{p.nickname}")</span>}
                                            </span>
                                            {p.player_number && <span className="text-[#D4AF37] font-mono text-sm">#{p.player_number}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono text-[#D4AF37]">{p.fargo_rating}</span>
                                        <button
                                            onClick={() => removePlayer(p.id)}
                                            className="group"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                minWidth: '24px',
                                                minHeight: '24px',
                                                borderRadius: '50%',
                                                backgroundColor: '#ef4444',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: 'none',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                            }}
                                            title="Remove Player"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '12px', height: '12px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Explicit spacer to force gap */}
                        <div className="h-12 w-full"></div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep('settings')}
                                className="flex-1 btn bg-surface border border-border"
                                style={{ color: '#D4AF37' }}
                            >
                                Back
                            </button>
                            <button onClick={handleNext} disabled={players.length < 2} className="flex-1 btn btn-primary disabled:opacity-50">
                                Next: Preview
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 'preview' && (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
                        <div className="flex flex-col gap-1 mb-8">
                            <p className="text-gray-400 capitalize">
                                {gameType} • {isHandicapped ? 'Handicapped' : 'Open'} • {isRated ? 'Rated' : 'Unrated'} • {tableCount} Tables
                            </p>
                            <p className="text-[#D4AF37]">
                                ${entryFee} Entry • ${moneyAdded} Added
                            </p>
                        </div>

                        <div className="bg-surface/30 p-6 rounded-xl border border-border mb-8">
                            <p className="text-sm text-gray-300">
                                Clicking "Start Tournament" will generate the double-elimination bracket and assign first round matches.
                            </p>
                        </div>

                        <button
                            onClick={createTournament}
                            disabled={loading}
                            className="w-full btn btn-primary py-4 text-lg"
                        >
                            {loading ? 'Creating...' : 'Start Tournament 🚀'}
                        </button>
                        <button onClick={() => setStep('players')} className="mt-4 text-gray-400 hover:text-white text-sm">
                            Go Back
                        </button>
                    </div>
                )}
            </div>
        </div>

    );
}
