import React, { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { ProfileSetup } from './screens/ProfileSetup';
import { Lobby } from './screens/Lobby';
import { DrawGuessGame } from './screens/DrawGuessGame';
import { CineQuizGame } from './screens/CineQuizGame';
import { GameOver } from './screens/GameOver';
import { AppState, GameType, Player, Room } from './types';
import { socket } from './services/mockSocket';
import { soundService } from './services/soundService';
import { GAMES } from './constants';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [selectedGameType, setSelectedGameType] = useState<GameType | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(soundService.getMuteStatus());
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Subscribe to Socket updates
    const unsubscribe = socket.subscribe((updatedRoom: Room | null) => {
      setRoom(updatedRoom ? { ...updatedRoom } : null);
      
      if (!updatedRoom) {
        setAppState(AppState.HOME);
        setJoinCode(null);
        setIsConnecting(false);
        return;
      }

      // Automatically infer game type from room if we joined late
      if (updatedRoom.gameType && !selectedGameType) {
          setSelectedGameType(updatedRoom.gameType);
      }

      // State Machine Logic
      if (updatedRoom.state === 'WAITING') {
        setAppState(AppState.LOBBY);
        setIsConnecting(false);
      } else if (updatedRoom.state === 'PLAYING') {
        setAppState(AppState.GAME_PLAYING);
      } else if (updatedRoom.state === 'FINISHED') {
        setAppState(AppState.GAME_OVER);
      }
    });

    return () => unsubscribe();
  }, [selectedGameType]);

  const handleGameSelect = (type: GameType) => {
    setSelectedGameType(type);
    setJoinCode(null);
    setAppState(AppState.PROFILE);
  };

  const handleJoinGame = (code: string) => {
      setJoinCode(code);
      // We don't know the game type yet, but ProfileSetup just needs a name which we can genericize
      setAppState(AppState.PROFILE);
  }

  const handleProfileComplete = async (player: Player) => {
    setIsConnecting(true);
    try {
      if (joinCode) {
          // Joining existing room
          setCurrentPlayer({ ...player, isHost: false });
          const success = await socket.joinRoom({ ...player, isHost: false }, joinCode);
          if (!success) {
              alert("Could not find room with that code or host is not reachable!");
              setIsConnecting(false);
              setAppState(AppState.HOME);
          }
      } else if (selectedGameType) {
          // Hosting new room
          setCurrentPlayer({ ...player, isHost: true });
          await socket.createRoom({ ...player, isHost: true }, selectedGameType);
          setIsConnecting(false);
      }
    } catch (error) {
      console.error("Connection error:", error);
      setIsConnecting(false);
    }
  };

  const toggleMute = () => {
      const muted = soundService.toggleMute();
      setIsMuted(muted);
  };

  const renderContent = () => {
    if (isConnecting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
                <div className="text-6xl animate-bounce mb-6">🚀</div>
                <h2 className="text-2xl font-bold mb-2 font-display">Connecting to Party...</h2>
                <p className="text-slate-400 text-sm mb-6">Setting up your game room</p>
                <button
                  onClick={() => {
                    socket.reset();
                    setIsConnecting(false);
                    setAppState(AppState.HOME);
                  }}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
            </div>
        )
    }

    if (!currentPlayer && appState !== AppState.HOME && appState !== AppState.PROFILE) {
        setAppState(AppState.HOME);
        return null;
    }

    switch (appState) {
      case AppState.HOME:
        return <Home onSelectGame={handleGameSelect} onJoinGame={handleJoinGame} />;
      
      case AppState.PROFILE:
        const gameTitle = selectedGameType 
            ? GAMES.find(g => g.id === selectedGameType)?.title 
            : "Friend's Party";
            
        return (
          <ProfileSetup 
            gameName={gameTitle || 'Game'} 
            onComplete={handleProfileComplete}
            onBack={() => setAppState(AppState.HOME)}
          />
        );

      case AppState.LOBBY:
        return room && currentPlayer ? <Lobby room={room} currentPlayerId={currentPlayer.id} /> : null;

      case AppState.GAME_PLAYING:
        if (!room || !currentPlayer) return null;
        if (room.gameType === GameType.DRAW_GUESS) {
          return <DrawGuessGame room={room} currentPlayerId={currentPlayer.id} />;
        } else {
          return <CineQuizGame room={room} currentPlayerId={currentPlayer.id} />;
        }

      case AppState.GAME_OVER:
        return room ? <GameOver room={room} /> : null;

      default:
        return <Home onSelectGame={handleGameSelect} onJoinGame={handleJoinGame} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-brand-primary selection:text-white pb-12">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-primary opacity-10 blur-[100px] rounded-full"></div>
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-brand-secondary opacity-10 blur-[100px] rounded-full"></div>
      </div>
      
      <button 
        onClick={toggleMute}
        className="fixed top-4 right-4 z-50 bg-brand-surface/80 backdrop-blur border border-slate-600 rounded-full p-3 text-xl hover:bg-slate-700 transition-colors shadow-lg"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      <div className="relative z-10">
        {renderContent()}
      </div>
    </div>
  );
}