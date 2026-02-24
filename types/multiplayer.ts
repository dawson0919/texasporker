import type { Card } from '../utils/poker';

export type GameStage = 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';
export type SeatStatus = 'waiting' | 'playing' | 'folded' | 'all-in' | 'sitting-out';

export interface PublicSeat {
    seatIndex: number;
    playerType: 'real' | 'ai';
    playerId: string;          // table_players.id (UUID)
    userId?: string;           // users.auth_id (Clerk ID) for real players
    displayName: string;
    avatarUrl: string;
    chipBalance: number;
    bet: number;
    totalInvested: number;
    status: SeatStatus;
    role?: 'dealer' | 'small_blind' | 'big_blind';
    lastAction?: string;
    handName?: string;
    isWinner?: boolean;
    revealedCards?: Card[];    // Only populated at SHOWDOWN
}

export interface ActionEntry {
    seatIndex: number;
    action: PlayerAction;
    amount?: number;
    displayName: string;
    timestamp: number;         // Date.now() for ordering
}

export interface PublicGameState {
    stage: GameStage;
    communityCards: Card[];
    potSize: number;
    currentBet: number;
    currentSeatIndex: number;      // -1 = no active player
    dealerSeatIndex: number;       // -1 = unset
    lastRaiserSeatIndex: number;
    isHandInProgress: boolean;
    seats: (PublicSeat | null)[];   // Always 8 slots; null = empty seat
    actedThisRound: number[];      // seatIndex values who acted this betting round
    handCount: number;
    actionLog: ActionEntry[];      // Actions since last broadcast (for client animation)
    autoStartAt?: string;          // ISO timestamp for countdown to next hand
    actionDeadline?: string;       // ISO timestamp for turn timer (30s)
}

// Private: each user fetches their own hole cards
export interface MyPrivateCards {
    tableId: string;
    seatIndex: number;
    holeCards: Card[];
}

// DB row types
export interface PokerTableRow {
    id: string;
    table_number: number;
    status: 'waiting' | 'playing' | 'closed';
    created_at: string;
    fill_deadline: string | null;
    hand_count: number;
    game_state: PublicGameState;
}

export interface TablePlayerRow {
    id: string;
    table_id: string;
    seat_index: number;
    player_type: 'real' | 'ai';
    user_id: string | null;
    display_name: string;
    avatar_url: string | null;
    chip_balance: number;
    hole_cards: Card[] | null;
    joined_at: string;
}

// API response types
export interface JoinResponse {
    tableId: string;
    seatIndex: number;
    tableNumber: number;
    fillDeadline: string | null;
    initialState: PublicGameState;
}

export interface ActionResponse {
    newState: PublicGameState;
    myHoleCards?: Card[];  // Returned on new hand start
}

// Constants
export const SMALL_BLIND = 50;
export const BIG_BLIND = 100;
export const MAX_SEATS = 8;
export const MAX_TABLES = 5;
export const FILL_DEADLINE_MS = 5 * 60 * 1000; // 5 minutes
export const TURN_TIMER_MS = 10 * 1000;         // 10 seconds

export const AI_NAMES = [
    '撲克王', '莎拉', '麥克', '幸運星', '大衛', '小美', '阿傑',
    '龍哥', '鳳姐', '金剛', '翠花', '老王', '小李', '阿強',
    '美玲', '志明', '春嬌', '阿寶', '小鬼', '大師',
];

export function createEmptyGameState(): PublicGameState {
    return {
        stage: 'WAITING',
        communityCards: [],
        potSize: 0,
        currentBet: 0,
        currentSeatIndex: -1,
        dealerSeatIndex: -1,
        lastRaiserSeatIndex: -1,
        isHandInProgress: false,
        seats: Array(MAX_SEATS).fill(null),
        actedThisRound: [],
        handCount: 0,
        actionLog: [],
    };
}
