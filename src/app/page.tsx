
"use client";

import { useState, useEffect } from 'react';
import { BookCopy, PlusSquare, BookOpen, Trash, Loader2 } from 'lucide-react';
import { WordCaptureForm } from '@/components/word-capture-form';
import { WordReviewList } from '@/components/word-review-list';
import { EditWordDialog } from '@/components/edit-word-dialog';
import { QuizView } from '@/components/quiz-view';
import type { CapturedWord, GenerateQuizOutput } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { generateQuizAction, generateStoryAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type View = 'capture' | 'review' | 'quiz';

export default function Home() {
  const [words, setWords] = useState<CapturedWord[]>([]);
  const [view, setView] = useState<View>('capture');
  const [editingWord, setEditingWord] = useState<CapturedWord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<CapturedWord | null>(null);
  const [quizData, setQuizData] = useState<{ questions: GenerateQuizOutput } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedWords = localStorage.getItem('lexi-capture-words');
      if (storedWords) {
        // When retrieving from localStorage, dates need to be converted back to Date objects
        const parsedWords = JSON.parse(storedWords).map((word: any) => ({
          ...word,
          capturedAt: new Date(word.capturedAt),
        }));
        setWords(parsedWords);
      }
    } catch (error) {
      console.error("Failed to parse words from localStorage", error);
    }
  }, []);

  useEffect(() => {
    // Save to localStorage, even if it's an empty array to clear it.
    try {
      localStorage.setItem('lexi-capture-words', JSON.stringify(words));
    } catch (error) {
      console.error("Failed to save words to localStorage", error);
    }
  }, [words]);

  const handleWordAdded = (newWord: CapturedWord) => {
    const { photoDataUri, ...wordToSave } = newWord;
    setWords((prevWords) => {
      const updatedWords = [wordToSave, ...prevWords];
      return updatedWords;
    });
    setView('review');
  };
  
  const handleMultipleWordsAdded = (newWords: CapturedWord[]) => {
    console.log('handleMultipleWordsAdded called with:', newWords);
    const wordsToSave = newWords.map(({ photoDataUri, ...word }) => word);
    console.log('Words to save:', wordsToSave);
    setWords((prevWords) => {
        const updatedWords = [...wordsToSave, ...prevWords];
        console.log('Updated words:', updatedWords);
        return updatedWords;
    });
    setView('review');
  };

  const handleEditWord = (word: CapturedWord) => {
    setEditingWord(word);
    setIsEditDialogOpen(true);
  };

  const handleWordUpdated = (updatedWord: CapturedWord) => {
    setWords(words.map(w => w.id === updatedWord.id ? updatedWord : w));
    setEditingWord(null);
  };

  const handleDeleteWord = (word: CapturedWord) => {
    setWordToDelete(word);
  };

  const confirmDelete = () => {
    if (wordToDelete) {
      setWords(words.filter(w => w.id !== wordToDelete.id));
      setWordToDelete(null);
    }
  };

  const cancelDelete = () => {
    setWordToDelete(null);
  };

  const handleGenerateQuiz = async (quizWords: CapturedWord[]) => {
    setIsLoading(true);
    const input = {
      words: quizWords.map(({ word, partOfSpeech, definition }) => ({ word, partOfSpeech, definition })),
    };
    const result = await generateQuizAction(input);
    if (result.success && result.data) {
      setQuizData(result.data);
      setView('quiz');
    } else {
      toast({
        variant: "destructive",
        title: "Quiz Generation Failed",
        description: result.error || "An unexpected error occurred.",
      });
    }
    setIsLoading(false);
  };

  const handleGenerateStory = async (storyWords: CapturedWord[]) => {
    setIsLoading(true);
    toast({ title: "Generating Story...", description: "Your story is being created by AI. This may take a moment." });
    const input = {
      words: storyWords.map(({ word, partOfSpeech, definition }) => ({ word, partOfSpeech, definition })),
    };
    const result = await generateStoryAction(input);
    if (result.success && result.data) {
      toast({
        title: "Story PDF Generated!",
        description: `Your PDF "${result.data.title}.pdf" has been downloaded.`,
      });
      if (result.data.pdfDataUri) {
        const link = document.createElement('a');
        link.href = result.data.pdfDataUri;
        link.download = `${result.data.title.replace(/\s/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      toast({
        variant: "destructive",
        title: "Story Generation Failed",
        description: result.error || "An unexpected error occurred.",
      });
    }
    setIsLoading(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-medium">AI is working its magic...</h3>
          <p className="text-sm text-muted-foreground">Please wait a moment.</p>
        </div>
      );
    }

    switch (view) {
      case 'capture':
        return <WordCaptureForm onWordAdded={handleWordAdded} onMultipleWordsAdded={handleMultipleWordsAdded} />;
      case 'review':
        return <WordReviewList words={words} onEditWord={handleEditWord} onDeleteWord={handleDeleteWord} onGenerateQuiz={handleGenerateQuiz} onGenerateStory={handleGenerateStory} />;
      case 'quiz':
        if (quizData) {
          return <QuizView quizData={quizData} onBack={() => setView('review')} />;
        }
        return null; // Or a fallback UI
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-secondary/50 flex flex-col">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BookCopy className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold font-headline tracking-tight">
                LexiCapture
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {renderContent()}
        </div>
      </main>

      <footer className="sticky bottom-0 bg-card border-t z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 h-16">
            <Button
              variant="ghost"
              className={cn(
                "h-full text-base flex-col gap-1",
                view === 'capture' ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={() => setView('capture')}
            >
              <PlusSquare />
              New Words
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "h-full text-base flex-col gap-1",
                view === 'review' ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={() => setView('review')}
            >
              <BookOpen />
              My Words
            </Button>
          </div>
        </nav>
      </footer>
      <EditWordDialog 
        word={editingWord}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onWordUpdated={handleWordUpdated}
      />
      <AlertDialog open={!!wordToDelete} onOpenChange={() => cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the word
              <span className="font-bold"> "{wordToDelete?.word}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
