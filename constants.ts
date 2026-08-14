import { GameType } from './types';

export const AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🦄', '🐙'];

export const GAMES = [
  {
    id: GameType.DRAW_GUESS,
    title: 'Draw & Guess',
    description: 'Sketch your way to victory! Draw words and guess what others are drawing.',
    icon: '✏️',
    color: 'bg-blue-500',
  },
  {
    id: GameType.CINE_QUIZ,
    title: 'Cine-Quiz',
    description: 'Test your movie knowledge with AI-generated plot summaries.',
    icon: '🎬',
    color: 'bg-rose-500',
  },
];

export const DEFAULT_SETTINGS = {
  [GameType.DRAW_GUESS]: { rounds: 3, timerSeconds: 60 },
  [GameType.CINE_QUIZ]: { rounds: 5, timerSeconds: 15 },
};