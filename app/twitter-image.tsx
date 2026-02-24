import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '澳門皇家撲克 - Texas Hold\'em';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1a0b0d 0%, #2d1418 40%, #1a0f0f 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background pattern */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexWrap: 'wrap',
                        opacity: 0.06,
                        fontSize: 60,
                        lineHeight: '80px',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {'♠ ♥ ♦ ♣ '.repeat(40)}
                </div>

                {/* Gold border */}
                <div
                    style={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        right: 20,
                        bottom: 20,
                        border: '2px solid rgba(212, 175, 55, 0.3)',
                        borderRadius: 24,
                        display: 'flex',
                    }}
                />

                {/* Main content */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 16,
                        zIndex: 1,
                    }}
                >
                    {/* Suits row */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        {['♠', '♥', '♦', '♣'].map((suit, i) => (
                            <div
                                key={i}
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: '50%',
                                    background: i % 2 === 0
                                        ? 'linear-gradient(135deg, #ee2b34, #cc2228)'
                                        : 'linear-gradient(135deg, #d4af37, #aa823c)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24,
                                    color: 'white',
                                    border: '3px solid rgba(255,255,255,0.3)',
                                }}
                            >
                                {suit}
                            </div>
                        ))}
                    </div>

                    {/* Title */}
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 800,
                            background: 'linear-gradient(180deg, #FCEda4 0%, #C9A25D 50%, #AA823C 100%)',
                            backgroundClip: 'text',
                            color: 'transparent',
                            display: 'flex',
                        }}
                    >
                        澳門皇家撲克
                    </div>

                    <div
                        style={{
                            fontSize: 28,
                            color: 'rgba(212, 175, 55, 0.8)',
                            letterSpacing: 12,
                            fontWeight: 600,
                            display: 'flex',
                        }}
                    >
                        MACAU ROYAL POKER
                    </div>

                    <div
                        style={{
                            width: 200,
                            height: 2,
                            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
                            margin: '8px 0',
                            display: 'flex',
                        }}
                    />

                    <div
                        style={{
                            fontSize: 22,
                            color: 'rgba(255, 255, 255, 0.6)',
                            display: 'flex',
                            gap: 16,
                        }}
                    >
                        <span style={{ display: 'flex' }}>🃏 德州撲克</span>
                        <span style={{ color: 'rgba(212, 175, 55, 0.4)', display: 'flex' }}>|</span>
                        <span style={{ display: 'flex' }}>💰 免費暢玩</span>
                        <span style={{ color: 'rgba(212, 175, 55, 0.4)', display: 'flex' }}>|</span>
                        <span style={{ display: 'flex' }}>🏆 排行榜競技</span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
