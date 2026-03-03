'use client';

interface EndSessionButtonProps {
    leagueId: string;
}

export default function EndSessionButton({ leagueId }: EndSessionButtonProps) {
    return (
        <form
            onSubmit={(e) => {
                if (!confirm('Are you sure you want to end this session? This action is difficult to undo!')) {
                    e.preventDefault();
                }
            }}
            action={async () => {
                const { submitLeagueResults } = await import("@/app/actions/league-actions");
                await submitLeagueResults(leagueId);
            }}
        >
            <button className="btn text-xs px-3 py-1 font-bold shadow-lg shadow-black/20" style={{ backgroundColor: '#D4AF37', color: 'black', border: '1px solid #D4AF37' }}>
                End Session
            </button>
        </form>
    );
}
