export enum GameType {
  DRAW_GUESS = 'DRAW_GUESS',
  CINE_QUIZ = 'CINE_QUIZ',
}

export enum AppState {
  HOME = 'HOME',
  PROFILE = 'PROFILE',
  LOBBY = 'LOBBY',
  GAME_PLAYING = 'GAME_PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum MovieCategory {
  ENGLISH = 'English',
  HINDI = 'Hindi',
  TELUGU = 'Telugu',
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // Emoji or simple ID
  score: number;
  isHost: boolean;
}

export interface RoomSettings {
  rounds: number;
  timerSeconds: number;
  category?: MovieCategory; // Specific to Cine-Quiz
}

export interface Room {
  code: string;
  players: Player[];
  settings: RoomSettings;
  gameType: GameType;
  currentRound: number;
  maxRounds: number;
  state: 'WAITING' | 'PLAYING' | 'FINISHED';
}

// Cine-Quiz Specifics
export interface QuizQuestion {
  plot: string;
  options: string[];
  correctIndex: number;
}

// Draw & Guess Specifics
export interface DrawWord {
  word: string;
  category: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  isSystem: boolean;
  isCorrectGuess: boolean;
}