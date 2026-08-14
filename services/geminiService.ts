import { MovieCategory, QuizQuestion } from "../types";

export const generateQuizQuestion = async (category: MovieCategory, previousPlots: string[]): Promise<QuizQuestion | null> => {
    try {
        const response = await fetch('/api/generateQuizQuestion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ category, previousPlots })
        });

        if (!response.ok) {
            console.error("API returned an error:", await response.text());
            return null;
        }

        const data = await response.json();
        return {
            plot: data.plot,
            options: data.options,
            correctIndex: data.correctAnswerIndex
        };
    } catch (error) {
        console.error("Error generating quiz question:", error);
        return null;
    }
};

export const generateDrawWords = async (): Promise<string[]> => {
  try {
      const response = await fetch('/api/generateDrawWords');
      if (!response.ok) {
          console.error("API returned an error:", await response.text());
          return ['Apple', 'Car', 'Tree']; // Fallback
      }
      return await response.json();
  } catch (e) {
      console.error("Error generating draw words:", e);
      return ['Ball', 'Fish', 'Star'];
  }
}
