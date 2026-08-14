import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  const FALLBACK_QUIZ_QUESTIONS: Record<string, Array<{ plot: string; options: string[]; correctAnswerIndex: number }>> = {
    English: [
      {
        plot: "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
        options: ["The Matrix", "Inception", "Tron", "Blade Runner", "Dark City", "Minority Report"],
        correctAnswerIndex: 0
      },
      {
        plot: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO.",
        options: ["Shutter Island", "Inception", "Tenet", "Memento", "Interstellar", "Source Code"],
        correctAnswerIndex: 1
      },
      {
        plot: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, a vigilante must accept one of the greatest psychological tests of his ability to fight injustice.",
        options: ["Batman Begins", "Watchmen", "The Dark Knight", "The Batman", "V for Vendetta", "Spider-Man 2"],
        correctAnswerIndex: 2
      },
      {
        plot: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.",
        options: ["Fight Club", "Seven", "American Psycho", "Memento", "Taxi Driver", "Gone Girl"],
        correctAnswerIndex: 0
      },
      {
        plot: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        options: ["Gravity", "The Martian", "Ad Astra", "Interstellar", "Arrival", "Moon"],
        correctAnswerIndex: 3
      },
      {
        plot: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
        options: ["The Green Mile", "The Shawshank Redemption", "Papillon", "Escape from Alcatraz", "Shutter Island", "Cool Hand Luke"],
        correctAnswerIndex: 1
      }
    ],
    Hindi: [
      {
        plot: "Two friends search for their long-lost college companion while revisiting their fun-filled days at a prestigious engineering institute.",
        options: ["3 Idiots", "Dil Chahta Hai", "Chhichhore", "Zindagi Na Milegi Dobara", "Rang De Basanti", "Taare Zameen Par"],
        correctAnswerIndex: 0
      },
      {
        plot: "Three friends decide to turn a fantasy vacation to Spain into reality before one of them gets married, confronting their inner fears.",
        options: ["Dil Dhadakne Do", "Yeh Jawaani Hai Deewani", "Zindagi Na Milegi Dobara", "Queen", "Cocktail", "Tamasha"],
        correctAnswerIndex: 2
      },
      {
        plot: "An alien stranded on Earth loses his communication device and questions human dogmas and religious superstitions in search of God.",
        options: ["Koi... Mil Gaya", "PK", "OMG - Oh My God!", "Lagaan", "Ra.One", "Krrish"],
        correctAnswerIndex: 1
      },
      {
        plot: "The people of a small village in Victorian India stake their future on a game of cricket against ruthless British officers to avoid harsh taxes.",
        options: ["Swades", "Chak De! India", "Mangal Pandey", "Lagaan", "Bhaag Milkha Bhaag", "83"],
        correctAnswerIndex: 3
      }
    ],
    Telugu: [
      {
        plot: "A fearless warrior goes to great lengths to rescue an exiled queen and discovers his royal heritage and true destiny in the kingdom of Mahishmati.",
        options: ["Baahubali: The Beginning", "RRR", "Magadheera", "Pushpa: The Rise", "Eega", "KGF: Chapter 1"],
        correctAnswerIndex: 0
      },
      {
        plot: "Two legendary revolutionaries embark on an epic journey away from home before they begin fighting for their country in the 1920s.",
        options: ["Sye Raa Narasimha Reddy", "RRR", "Baahubali 2", "Rangasthalam", "Ala Vaikunthapurramuloo", "Devara"],
        correctAnswerIndex: 1
      },
      {
        plot: "A murdered man is reincarnated as a common housefly and seeks revenge against the wealthy criminal who killed him and threatens his lover.",
        options: ["Magadheera", "Maryada Ramanna", "Eega", "Arundhati", "Vikramarkudu", "Chatrapathi"],
        correctAnswerIndex: 2
      },
      {
        plot: "A laborer rises through the ranks of the red sandalwood smuggling syndicate in the Seshachalam hills.",
        options: ["Pushpa: The Rise", "Rangasthalam", "KGF", "Waltair Veerayya", "Salaar", "Sarileru Neekevvaru"],
        correctAnswerIndex: 0
      }
    ]
  };

  const FALLBACK_WORDS = [
    ['Pizza', 'Rocket', 'Guitar'],
    ['Elephant', 'Castle', 'Bicycle'],
    ['Helicopter', 'Penguin', 'Volcano'],
    ['Rainbow', 'Cactus', 'Telescope'],
    ['Robot', 'Dragon', 'Anchor'],
    ['Cupcake', 'Lighthouse', 'Submarine'],
    ['Crown', 'Campfire', 'Spaceship']
  ];

  app.post("/api/generateQuizQuestion", async (req, res) => {
    const { category = 'English', previousPlots = [] } = req.body || {};
    const catKey = category in FALLBACK_QUIZ_QUESTIONS ? category : 'English';
    const fallbackList = FALLBACK_QUIZ_QUESTIONS[catKey];
    const availableFallbacks = fallbackList.filter(q => !previousPlots.includes(q.plot));
    const defaultFallback = availableFallbacks.length > 0
      ? availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)]
      : fallbackList[Math.floor(Math.random() * fallbackList.length)];

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json(defaultFallback);
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Generate a one-line plot summary for a famous ${category} movie and 6 multiple choice options (movie titles). 
      The wrong options must be confusingly similar (same genre, actor, or era). 
      Ensure the plot is concise but specific.
      ${previousPlots && previousPlots.length > 0 ? `Do NOT use these plots: ${JSON.stringify(previousPlots)}` : ''}`;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      plot: { type: Type.STRING, description: "The one-sentence plot summary." },
                      options: { 
                          type: Type.ARRAY, 
                          items: { type: Type.STRING },
                          description: "Array of 6 movie titles." 
                      },
                      correctAnswerIndex: { 
                          type: Type.INTEGER, 
                          description: "The index (0-5) of the correct movie in the options array." 
                      }
                  },
                  required: ["plot", "options", "correctAnswerIndex"]
              }
          }
      });

      if (response.text) {
          const parsed = JSON.parse(response.text);
          if (parsed && parsed.plot && Array.isArray(parsed.options) && typeof parsed.correctAnswerIndex === 'number') {
            return res.json(parsed);
          }
      }
      res.json(defaultFallback);
    } catch (error) {
      console.warn("Using fallback quiz question due to error:", error);
      res.json(defaultFallback);
    }
  });

  app.get("/api/generateDrawWords", async (req, res) => {
    const randomFallback = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json(randomFallback);
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: "Generate 3 distinct, simple, fun nouns that are easy to draw for Pictionary. Return them as a JSON list of strings.",
          config: {
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
              }
          }
      });
      
      if (response.text) {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return res.json(parsed.slice(0, 3));
          }
      }
      res.json(randomFallback);
    } catch (error) {
      console.warn("Using fallback draw words due to error:", error);
      res.json(randomFallback);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
