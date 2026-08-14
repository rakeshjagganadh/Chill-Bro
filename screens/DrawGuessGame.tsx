import React, { useEffect, useRef, useState } from 'react';
import { Player, Room, ChatMessage } from '../types';
import { Button } from '../components/Button';
import { socket } from '../services/mockSocket';
import { generateDrawWords } from '../services/geminiService';
import { soundService } from '../services/soundService';

interface DrawGuessGameProps {
  room: Room;
  currentPlayerId: string;
}

export const DrawGuessGame: React.FC<DrawGuessGameProps> = ({ room, currentPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(room.settings.timerSeconds);
  const [roundState, setRoundState] = useState<'CHOOSING' | 'DRAWING' | 'ENDED'>('CHOOSING');

  const artistIndex = (room.currentRound - 1) % (room.players.length || 1);
  const artist = room.players[artistIndex] || room.players[0];
  const isArtist = artist ? artist.id === currentPlayerId : false;
  const isHost = room.players.find(p => p.id === currentPlayerId)?.isHost;

  // Subscribe to drawing events from other players
  useEffect(() => {
    const unsubscribeDraw = socket.onEvent('DRAW_EVENT', (data) => {
        handleRemoteDrawEvent(data);
    });

    const unsubscribeChat = socket.onEvent('CHAT', (msg) => {
        setMessages(prev => [...prev, msg]);
        if (msg.isCorrectGuess) {
            soundService.play('success');
        }
    });

    return () => {
        unsubscribeDraw();
        unsubscribeChat();
    };
  }, []);

  // Init Round
  useEffect(() => {
    setRoundState('CHOOSING');
    setTimeLeft(15); 
    setMessages([]); // Clear chat for new round
    setSelectedWord(null);

    // Clear canvas
    if (canvasRef.current) {
       const ctx = canvasRef.current.getContext('2d');
       ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    if (isArtist) {
      generateDrawWords().then(setWords);
    } else if (isHost && artist?.id?.startsWith('bot_')) {
      // Auto-choose word for bot artist
      generateDrawWords().then(botWords => {
        if (botWords && botWords.length > 0) {
          const chosen = botWords[0];
          setTimeout(() => {
            handleWordSelect(chosen);
          }, 1500);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.currentRound]);

  // Timer
  useEffect(() => {
      const interval = setInterval(() => {
          setTimeLeft((prev) => {
              if (prev <= 5 && prev > 0) soundService.play('tick');

              if (prev <= 1) {
                  if (roundState === 'CHOOSING') {
                      if (isArtist && !selectedWord && words.length > 0) {
                        handleWordSelect(words[0]);
                      }
                      return 0;
                  }
                  if (roundState === 'DRAWING') {
                      setRoundState('ENDED');
                      soundService.play('error');
                      return 0;
                  }
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(interval);
  }, [roundState, isArtist, selectedWord, words]);

  // Drawing Logic
  const handleRemoteDrawEvent = (data: any) => {
      if (data.action === 'word_chosen') {
          setSelectedWord(data.word);
          setRoundState('DRAWING');
          setTimeLeft(room.settings.timerSeconds);
          return;
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !canvasRef.current) return;

      if (data.action === 'start') {
          ctx.beginPath();
          ctx.moveTo(data.x, data.y);
          ctx.lineWidth = data.size;
          ctx.lineCap = 'round';
          ctx.strokeStyle = data.color;
      } else if (data.action === 'draw') {
          ctx.lineTo(data.x, data.y);
          ctx.stroke();
      } else if (data.action === 'clear') {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          soundService.play('click');
      }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;
    
    // Normalize coordinates to 800x600 canvas resolution for consistency across screens
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: x * scaleX, y: y * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isArtist || roundState !== 'DRAWING') return;
    const { x, y } = getCoordinates(e);

    setIsDrawing(true);
    
    // Draw locally
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    // Send to peers
    socket.sendDrawEvent({ action: 'start', x, y, color, size: brushSize });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isArtist || roundState !== 'DRAWING') return;
    const { x, y } = getCoordinates(e);

    // Draw locally
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();

    // Send to peers
    socket.sendDrawEvent({ action: 'draw', x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  const clearCanvas = () => {
      soundService.play('click');
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      socket.sendDrawEvent({ action: 'clear' });
  }

  const handleWordSelect = (word: string) => {
    soundService.play('start');
    setSelectedWord(word);
    setRoundState('DRAWING');
    setTimeLeft(room.settings.timerSeconds);
    
    // Notify peers about word selection
    socket.sendDrawEvent({ action: 'word_chosen', word, wordLength: word.length });

    // Send system message
    socket.sendChat({
      id: Math.random().toString(),
      playerId: 'system',
      playerName: 'System',
      text: `${artist?.name || 'Artist'} is drawing!`,
      isSystem: true,
      isCorrectGuess: false
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const isCorrect = selectedWord && chatInput.trim().toLowerCase() === selectedWord.trim().toLowerCase();

    const msg: ChatMessage = {
      id: Math.random().toString(),
      playerId: currentPlayerId,
      playerName: room.players.find(p => p.id === currentPlayerId)?.name || 'Unknown',
      text: chatInput,
      isSystem: false,
      isCorrectGuess: !!isCorrect
    };

    if (isCorrect) {
        socket.updateScore(currentPlayerId, Math.max(10, timeLeft * 10));
        socket.sendChat({
            ...msg,
            text: 'Guessed the word! 🎉' // Mask the word for others
        });
    } else {
        socket.sendChat(msg);
    }
    
    setChatInput('');
  };

  if (roundState === 'ENDED') {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8">
              <h2 className="text-4xl font-display mb-4">Time's Up!</h2>
              <p className="text-xl text-slate-400 mb-8">The word was <span className="text-brand-primary font-bold uppercase">{selectedWord || "Hidden"}</span></p>
              
              {room.players.find(p => p.id === currentPlayerId)?.isHost ? (
                   <Button onClick={() => {
                       socket.nextRound(); 
                    }}>
                       {room.currentRound >= room.maxRounds ? 'End Game' : 'Next Round'}
                   </Button>
              ) : (
                  <p className="animate-pulse">Waiting for host...</p>
              )}
          </div>
      )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 h-[calc(100vh-80px)] flex flex-col md:flex-row gap-4">
      {/* Sidebar - Players */}
      <div className="w-full md:w-48 flex-shrink-0 flex flex-col gap-2 overflow-y-auto hidden md:flex">
        {room.players.sort((a,b) => b.score - a.score).map((p, i) => (
            <div key={p.id} className={`p-2 rounded-lg border ${p.id === artist.id ? 'bg-brand-surface border-brand-primary' : 'bg-brand-dark border-slate-700'} flex items-center justify-between`}>
                <div>
                    <div className="text-xs text-slate-400">#{i+1}</div>
                    <div className="font-bold text-sm truncate w-24">{p.name}</div>
                </div>
                <div className="font-bold text-brand-secondary">{p.score}</div>
                {p.id === artist.id && <span className="absolute -left-2 text-xl">✏️</span>}
            </div>
        ))}
      </div>

      {/* Main Game Area */}
      <div className="flex-grow flex flex-col relative bg-brand-surface rounded-xl border border-slate-700 overflow-hidden">
        {/* Toolbar */}
        <div className="h-14 bg-brand-dark border-b border-slate-700 flex items-center justify-between px-4">
            <div className={`font-mono text-xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-brand-accent'}`}>{timeLeft}s</div>
            
            <div className="text-center">
                {roundState === 'CHOOSING' ? (
                    <span className="text-yellow-400 font-bold animate-pulse">
                        {isArtist ? "CHOOSE A WORD!" : `${artist.name} is choosing...`}
                    </span>
                ) : (
                    <span className="font-bold tracking-widest text-lg">
                        {isArtist || roundState === 'ENDED' ? selectedWord : (selectedWord ? selectedWord.replace(/./g, '_ ') : '???')}
                    </span>
                )}
            </div>

            {isArtist && (
                <button onClick={clearCanvas} className="text-xs text-slate-400 hover:text-white">Clear</button>
            )}
        </div>

        {/* Word Overlay for Artist */}
        {roundState === 'CHOOSING' && isArtist && (
            <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center">
                <h3 className="text-2xl font-bold mb-6">Pick a word!</h3>
                <div className="flex gap-4">
                    {words.map(w => (
                        <button 
                            key={w}
                            onClick={() => handleWordSelect(w)}
                            className="bg-brand-primary hover:bg-brand-secondary px-6 py-4 rounded-xl font-bold text-xl transition-transform hover:scale-105"
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Canvas */}
        <div className="flex-grow relative cursor-crosshair bg-white">
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="w-full h-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>

        {/* Artist Tools */}
        {isArtist && roundState === 'DRAWING' && (
            <div className="h-16 bg-brand-dark border-t border-slate-700 flex items-center justify-center gap-4 px-4">
                <div className="flex gap-2">
                    {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308'].map(c => (
                        <button
                            key={c}
                            onClick={() => {
                                setColor(c);
                                soundService.play('click');
                            }}
                            className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <div className="w-px h-8 bg-slate-700 mx-2"></div>
                <input 
                    type="range" min="2" max="20" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-24 accent-brand-primary"
                />
            </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-72 flex-shrink-0 flex flex-col bg-brand-surface rounded-xl border border-slate-700 h-64 md:h-auto">
          <div className="flex-grow overflow-y-auto p-4 space-y-2 flex flex-col-reverse custom-scrollbar">
              {messages.slice().reverse().map(msg => (
                  <div key={msg.id} className={`text-sm ${msg.isSystem ? 'text-green-400 font-bold text-center' : msg.isCorrectGuess ? 'text-green-400 bg-green-900/20 p-2 rounded' : ''}`}>
                      {!msg.isSystem && <span className="font-bold text-slate-400">{msg.playerName}: </span>}
                      {msg.isCorrectGuess ? 'Guessed the word!' : msg.text}
                  </div>
              ))}
          </div>
          <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-700">
              <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isArtist || roundState !== 'DRAWING'}
                  placeholder={isArtist ? "You are drawing!" : "Type your guess here..."}
                  className="w-full bg-brand-dark border border-slate-600 rounded-lg p-2 text-sm focus:outline-none focus:border-brand-primary"
              />
          </form>
      </div>
    </div>
  );
};