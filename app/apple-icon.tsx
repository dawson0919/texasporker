import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 180,
                    height: 180,
                    borderRadius: 40,
                    background: 'linear-gradient(135deg, #1a0b0d, #2d1418)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 4,
                }}
            >
                <div
                    style={{
                        fontSize: 60,
                        color: '#ee2b34',
                        display: 'flex',
                    }}
                >
                    ♠
                </div>
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        background: 'linear-gradient(180deg, #FCEda4, #AA823C)',
                        backgroundClip: 'text',
                        color: 'transparent',
                        display: 'flex',
                    }}
                >
                    POKER
                </div>
            </div>
        ),
        { ...size }
    );
}
