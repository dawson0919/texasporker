declare module 'pokersolver' {
    export class Card {
        value: string;
        suit: string;
        rank: number;
        wildValue: string;
        constructor(str: string);
        toString(): string;
        static sort(a: Card, b: Card): number;
    }

    export class Hand {
        cardPool: Card[];
        cards: Card[];
        suits: Record<string, Card[]>;
        values: Card[][];
        wilds: Card[];
        name: string;
        game: Game;
        rank: number;
        descr: string;
        sfLength: number;
        alwaysQualifies: boolean;
        [key: string]: any;

        static solve(cards: string[], game?: string | Game, canDisqualify?: boolean): Hand;
        static winners(hands: Hand[]): Hand[];
    }

    export class Game {
        descr: string;
        handValues: any[];
        wildValue: string | null;
        wildStatus: number;
        wheelStatus: number;
        sfpiStatus: number;
        lowestQualified: any;
        constructor(descr?: string);
    }
}
