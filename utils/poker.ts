import * as PokerSolver from 'pokersolver';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Helper to convert our Card to pokersolver format (e.g. "As", "10h", "Qd")
export function toPokerSolverCard(card: Card): string {
    const suitMap: Record<Suit, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
    const rankMap: Record<Rank, string> = {
        'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
        '8': '8', '9': '9', '10': 'T', 'J': 'J', 'Q': 'Q', 'K': 'K'
    };
    return `${rankMap[card.rank]}${suitMap[card.suit]}`;
}

export class Deck {
    private cards: Card[] = [];

    constructor() {
        this.reset();
    }

    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push({ suit, rank });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count: number = 1): Card[] {
        if (this.cards.length < count) {
            throw new Error("Not enough cards in deck");
        }
        return this.cards.splice(0, count);
    }
}

// Evaluates a set of 7 cards (2 hole + 5 community) and returns the solved Hand object
export function evaluateHand(holeCards: Card[], communityCards: Card[]): PokerSolver.Hand {
    const allCards = [...holeCards, ...communityCards].map(toPokerSolverCard);
    return PokerSolver.Hand.solve(allCards);
}

// Determines winners from an array of player hands
// playerHands: array of { playerId: string, holeCards: Card[] }
export function determineWinners(playerHands: { playerId: string, holeCards: Card[] }[], communityCards: Card[]) {
    const solvedHands = playerHands.map(p => {
        const solved = evaluateHand(p.holeCards, communityCards);
        solved.playerId = p.playerId; // attach ID to the hand object for tracing back
        return solved;
    });

    // Winners array
    const winners = PokerSolver.Hand.winners(solvedHands);

    // Extract player IDs of the winners
    const winningPlayerIds: string[] = winners.map((w: any) => w.playerId);

    // Get the name of the winning hand (e.g., "Flush", "Two Pair")
    const handName: string = winners.length > 0 ? winners[0].name : "High Card";

    return { winningPlayerIds, handName, allHands: solvedHands };
}
