// TRON production constants, sample draw data, and BigInt-safe USDT formatting.
export const TICKET_PRICE = 10_000_000n;
export const TREASURY_BPS = 3_000n;
export const MIN_PLAYERS = 500;
export const MAX_TICKETS_PER_USER = 100;
export const ACTIVE_DRAW_ID = 1043;

export type DrawRecord = {
  id: number;
  date: string;
  winner: string;
  prize: bigint;
  tickets: number;
  randomWord: string;
  txHash: string;
};

export type ActivityRecord = {
  address: string;
  quantity: number;
  age: string;
  txHash: string;
};

export const TRON_USDT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const LOTTERY_CONTRACT_PENDING = "Awaiting audited TRON contract";
export const SAMPLE_WALLET = "TQ8aZ3pgJxVN4bD6Hk2sWm9R7cY5uF1eM7";

export const recentActivity: ActivityRecord[] = [
  { address: "TX6f…p9C2", quantity: 4, age: "12s ago", txHash: "a84f…29c1" },
  { address: "TD2b…mE70", quantity: 1, age: "28s ago", txHash: "16db…7ed0" },
  { address: "TKC9…z88e", quantity: 10, age: "1m ago", txHash: "b723…11ad" },
  { address: "TWaD…vB31", quantity: 2, age: "2m ago", txHash: "4fc9…82be" },
  { address: "TE52…x40F", quantity: 6, age: "3m ago", txHash: "302e…ea61" },
];

export const drawHistory: DrawRecord[] = [
  {
    id: 1042,
    date: "Sep 3, 2026",
    winner: SAMPLE_WALLET,
    prize: 12_348_000_000n,
    tickets: 1764,
    randomWord: "84410771907170586121867734912252898306634886498621043876193596084723495103274",
    txHash: "2a914fbe5d4a994b4ea5c9a1dc741f7c619af847847953245153c986220168e0",
  },
  {
    id: 1041,
    date: "Aug 27, 2026",
    winner: "TW9aD13C74128a1Aa7207527642166129v7B31E2",
    prize: 10_920_000_000n,
    tickets: 1560,
    randomWord: "6617882474733391197100432177395093636678529559220861878364201887247105109736",
    txHash: "939f1640352367d71286e3c3a1c878721b984e02bb5bbce8dc244285f998775b",
  },
  {
    id: 1040,
    date: "Aug 20, 2026",
    winner: "TX8A6fd97C1aB2eD29d4C0Bb394C8d71p9C2",
    prize: 9_849_000_000n,
    tickets: 1407,
    randomWord: "47332941340077640049892151138790870925803325645100384648003833634732675600534",
    txHash: "d8eab409dbf2444391743cc1b7c6f644651db2b9aafba1ccb29d4b9af0ef5bfa",
  },
  {
    id: 1039,
    date: "Aug 13, 2026",
    winner: "TD12b571835fAF9394Ac141aAD6A77BBmE70",
    prize: 11_067_000_000n,
    tickets: 1581,
    randomWord: "106458598348971047669011647938469062130252744155196135192537866230050664834528",
    txHash: "6ce7c22b6b8cb721ae2b1f3499a9eeaf31ee422eaa3a850a8308ba10de14b116",
  },
  {
    id: 1038,
    date: "Aug 6, 2026",
    winner: "TK41C969C1029859C5e88d31Bf9D6a4fz88e",
    prize: 8_736_000_000n,
    tickets: 1248,
    randomWord: "17841575634727534408255990082561918688167976042637120559304413300612770218970",
    txHash: "73fe8e93bb83cf238d331a8efc1095e516d971406d2d13ae16dc15ee3ee5fbde",
  },
];

export function formatUsdt(amount: bigint, showSymbol = false): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = fraction === "00" ? "" : `.${fraction.replace(/0$/, "")}`;
  return `${showSymbol ? "$" : ""}${grouped}${decimal}`;
}

export function shortAddress(address: string): string {
  return address.length > 13 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
