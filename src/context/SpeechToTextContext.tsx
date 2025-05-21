import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { Notice } from 'obsidian';
import { getPluginSettings } from '../settings/PluginSettings';
import OpenAI from 'openai';
import { useLNMode } from './LNModeContext';
import { t } from '../i18n';

const MAX_AUDIO_PROMPT_LENGTH = 5000;

interface SpeechToTextContextType {
  isRecording: boolean;
  isTranscribing: boolean;
  lastTranscription: string | null;
  startRecording: (signal: AbortSignal) => Promise<void>;
  finalizeRecording: () => Promise<void>;
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
  const { activeModeId, lnModes } = useLNMode();
  const activeMode = lnModes[activeModeId];


  const startRecording = async (signal: AbortSignal): Promise<void> => {
    try {
      // Reset audio chunks in ref only
      audioChunksRef.current = [];
      
      // Get microphone access with specific constraints for better audio quality
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000 // Using 16kHz sample rate for better compatibility with speech recognition
        } 
      });
      
      // Only use formats definitely supported by OpenAI's API
      let options = {};
      
      // Check if we're on iOS Safari
      
      // For other platforms, use the original order
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
        console.log('dataavailable event', event);
        if (event.data.size > 0) {
          // Update only the ref
          audioChunksRef.current = [...audioChunksRef.current, event.data];
        }
      });

      signal.addEventListener('abort', () => {
        console.log('abort event');
        recorder.stop();
      });
      
      recorder.addEventListener('stop', async () => {
        setIsRecording(false);
        console.log('stop event');
        // When recording stops, transcribe the audio using the ref value
        if (!signal.aborted) {
          await transcribeAudio(recorder, signal);
        }
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      });
      
      // Start recording as a single chunk to ensure integrity
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      
      let errorMessage = t('errors.tts.microphone.general');
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          errorMessage = t('errors.tts.microphone.accessDenied');
        } else if (error.name === 'NotFoundError') {
          errorMessage = t('errors.tts.microphone.notFound');
        } else if (error.name === 'NotReadableError') {
          errorMessage = t('errors.tts.microphone.inUse');
        }
      }
      
      new Notice(errorMessage);
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (recorder: MediaRecorder, signal: AbortSignal): Promise<void> => {
    const chunks = audioChunksRef.current;
    if (!chunks.length) throw new Error('No audio chunks to transcribe');
    
    setIsTranscribing(true);
    
    try {
      const apiKey = getPluginSettings().openAIApiKey;
      if (!apiKey) {
        throw new Error('OpenAI API key is not configured');
      }
      
      // Create audio blob from chunks in ref
      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });
      
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      console.log('Audio blob type:', audioBlob.type);
      
      // Don't attempt to transcribe if the audio is too small (likely no speech)
      if (audioBlob.size < 1000) {
        throw new Error('Recording too short or no audio detected');
      }
      
      // --- END EDIT ---
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });
      
      // Map mime types to OpenAI-compatible extensions
      let fileExtension;
      if (mimeType.includes('webm')) {
        fileExtension = 'webm';
      } else if (mimeType.includes('mp3')) {
        fileExtension = 'mp3';
      } else if (mimeType.includes('wav')) {
        fileExtension = 'wav';
      } else if (mimeType.includes('mp4')) {
        fileExtension = 'mp4';
      } else if (mimeType.includes('m4a')) {
        fileExtension = 'm4a';
      } else {
        // Default to webm if we can't determine the type
        fileExtension = 'webm';
      }
      
      console.log(`Creating file with extension: .${fileExtension} and type: ${mimeType}`);


      // Create a proper File object (which extends Blob) that the OpenAI SDK can use
      const file = new File(
        [audioBlob], 
        `recording.${fileExtension}`, 
        { type: mimeType }
      );
      
      console.log(`Transcribing audio using gpt-4o-transcribe model as recording.${fileExtension}`);
      
      // Call OpenAI API for transcription using the SDK
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'gpt-4o-transcribe',
        prompt: activeMode.ln_system_prompt.substring(0, MAX_AUDIO_PROMPT_LENGTH),
        language: 'pl',
      }, {
        signal: signal,
      });

      console.log('Transcribed text:', transcription.text);
      setLastTranscription(transcription.text);
    } catch (error) {
      console.error('Error during transcription:', error);

      // If not aborted, show error notice
      if (!signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription';
        new Notice(t('errors.tts.transcriptionFailed').replace('{{error}}', errorMessage));
      }

      throw error;
    } finally {
      setIsTranscribing(false);
    }
  };

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
    finalizeRecording
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
