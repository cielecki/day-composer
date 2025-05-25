import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { Notice, moment } from 'obsidian';
import { getPluginSettings } from '../settings/PluginSettings';
import OpenAI from 'openai';
import { t } from '../i18n';
import { ContextCollector } from '../context-collector';

const MAX_AUDIO_PROMPT_LENGTH = 5000;

interface SpeechToTextContextType {
  isRecording: boolean;
  isTranscribing: boolean;
  lastTranscription: string | null;
  startRecording: (signal: AbortSignal) => Promise<void>;
  finalizeRecording: () => Promise<void>;
  cancelTranscription: () => void;
}

const SpeechToTextContext = createContext<SpeechToTextContextType | undefined>(undefined);

export const SpeechToTextProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);
  const transcriptionAbortControllerRef = useRef<AbortController | null>(null);

  const startRecording = async (signal: AbortSignal): Promise<void> => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp3')) {
        options = { mimeType: 'audio/mp3' };
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options = { mimeType: 'audio/wav' };
      } else if (MediaRecorder.isTypeSupported('audio/m4a')) {
        options = { mimeType: 'audio/m4a' };
      }
      const recorder = new MediaRecorder(stream, options);
      
      console.log('Using audio format:', recorder.mimeType);


      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current = [...audioChunksRef.current, event.data];
        }
      });
      signal.addEventListener('abort', () => recorder.stop());
      recorder.addEventListener('stop', async () => {
        setIsRecording(false);
        if (!signal.aborted) {
          await transcribeAudio(recorder, signal);
        }
        stream.getTracks().forEach(track => track.stop());
      });
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      let errorMessage = t('errors.tts.microphone.general');
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') errorMessage = t('errors.tts.microphone.accessDenied');
        else if (error.name === 'NotFoundError') errorMessage = t('errors.tts.microphone.notFound');
        else if (error.name === 'NotReadableError') errorMessage = t('errors.tts.microphone.inUse');
      }
      new Notice(errorMessage);
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (recorder: MediaRecorder, signal: AbortSignal): Promise<void> => {
    const chunks = audioChunksRef.current;
    if (!chunks.length) throw new Error('No audio chunks to transcribe');
    
    setIsTranscribing(true);
    
    // Create a new abort controller for transcription
    const transcriptionController = new AbortController();
    transcriptionAbortControllerRef.current = transcriptionController;
    
    try {
      const pluginSettings = getPluginSettings();
      if (!pluginSettings.openAIApiKey) {
        throw new Error('OpenAI API key is not configured');
      }
      
      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });
      
      if (audioBlob.size < 1000) {
        throw new Error('Recording too short or no audio detected');
      }
      
      const openai = new OpenAI({
        apiKey: pluginSettings.openAIApiKey,
        dangerouslyAllowBrowser: true,
      });
      
      let fileExtension = 'webm';
      if (mimeType.includes('mp3')) fileExtension = 'mp3';
      else if (mimeType.includes('wav')) fileExtension = 'wav';
      else if (mimeType.includes('mp4')) fileExtension = 'mp4';
      else if (mimeType.includes('m4a')) fileExtension = 'm4a';
      
      const file = new File([audioBlob], `recording.${fileExtension}`, { type: mimeType });
      
      const currentLang = moment.locale(); // e.g., 'en', 'pl'
      let targetLanguageForApi = currentLang; // Language to tell OpenAI API
      let promptToUse = pluginSettings.speechToTextPrompt;

      // Fallback logic for prompt
      if (!promptToUse) {
        promptToUse = t('settings.prompts.defaultPrompt');
      }
      
      // Ensure targetLanguageForApi is a 2-letter code if possible, or supported by API
      // OpenAI Whisper supports many languages, but usually with 2-letter codes for the `language` param.
      // This might need adjustment if moment.locale() gives longer codes like 'en-US'.
      if (targetLanguageForApi.includes('-')) {
        targetLanguageForApi = targetLanguageForApi.split('-')[0];
      }
      // List of Whisper supported languages could be checked here if more robustness is needed.
      // For now, we'll pass the derived targetLanguageForApi.

      const contextCollector = new ContextCollector(window.app);
      const expandedPrompt = await contextCollector.expandLinks(promptToUse);
      const trimmedPrompt = expandedPrompt.length > MAX_AUDIO_PROMPT_LENGTH 
        ? expandedPrompt.substring(0, Math.floor(MAX_AUDIO_PROMPT_LENGTH / 2)) + "..." + expandedPrompt.substring(expandedPrompt.length - Math.floor(MAX_AUDIO_PROMPT_LENGTH / 2))
        : expandedPrompt;

      console.log(`Transcribing audio. Language for API: ${targetLanguageForApi}. Using prompt:`, trimmedPrompt);
      
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'gpt-4o-transcribe',
        prompt: trimmedPrompt,
        language: targetLanguageForApi, // Pass the determined language to API
      }, { signal: transcriptionController.signal });

      console.log('Transcribed text:', transcription.text);
      setLastTranscription(transcription.text);
    } catch (error) {
      console.error('Error during transcription:', error);

      // If not aborted, show error notice
      if (!transcriptionController.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription';
        new Notice(t('errors.tts.transcriptionFailed').replace('{{error}}', errorMessage));
      }

      throw error;
    } finally {
      setIsTranscribing(false);
      transcriptionAbortControllerRef.current = null;
    }
  };

  const cancelTranscription = useCallback(() => {
    console.log("Cancelling transcription");
    if (transcriptionAbortControllerRef.current) {
      transcriptionAbortControllerRef.current.abort();
      transcriptionAbortControllerRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback(async () => {
    console.log("Stopping speech-to-text operations");

    
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  }, [mediaRecorder, isRecording]);

  // Build context value
  const value = {
    isRecording,
    isTranscribing,
    lastTranscription,
    startRecording,
    finalizeRecording,
    cancelTranscription
  };

  return (
    <SpeechToTextContext.Provider value={value}>
      {children}
    </SpeechToTextContext.Provider>
  );
};

// Custom hook for using the Speech To Text context
export const useSpeechToText = () => {
  const context = useContext(SpeechToTextContext);
  if (context === undefined) {
    throw new Error('useSpeechToText must be used within a SpeechToTextProvider');
  }
  return context;
};
