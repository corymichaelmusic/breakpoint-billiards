'use client';

import { useEffect, useState } from 'react';
import MatchControlModal from '@/components/MatchControlModal';
import TournamentBracket from '@/components/TournamentBracket';

interface Match {
    id: string;
    match_position_code: string;
    round_label: string;
    status: string;
    table_assigned: string | null;
    score1: number;
    score2: number;
    player1?: any;
    player2?: any;
    [key: string]: any;
}

interface Participant {
    seed: number;
    player: { full_name: string; fargo_rating: number; id: string };
}

interface TournamentManagerClientProps {
    initialMatches: Match[];
    initialParticipants: Participant[];
    tournamentId: string;
    tableConfig: string[];
}

export default function TournamentManagerClient({
    initialMatches,
    initialParticipants,
    tournamentId,
    tableConfig
}: TournamentManagerClientProps) {
    const [matches, setMatches] = useState<Match[]>(initialMatches);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    // Sync state with props if server revalidates (e.g. after table assignment)
    useEffect(() => {
        setMatches(initialMatches);
    }, [initialMatches]);

    const handleMatchClick = (match: Match) => {
        // Prevent opening completed or placeholder matches (unless admin override?)
        // For MVP, allow opening any non-placeholder match to fix scores or something
        // Just check if it has players populated or we want to assign table.
        if (match.player1 || match.player2) {
            setSelectedMatch(match);
        }
    };

    const handleCloseModal = () => {
        setSelectedMatch(null);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">

            {/* Modal */}
            {selectedMatch && (
                <MatchControlModal
                    match={selectedMatch}
                    tableConfig={tableConfig}
                    onClose={handleCloseModal}
                />
            )}

            {/* Bracket View */}
            <div className="flex-1 overflow-hidden relative">
                <TournamentBracket
                    matches={matches}
                    onMatchClick={handleMatchClick}
                />
            </div>
        </div>
    );
}
