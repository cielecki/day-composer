// TTS Streaming Service - Production-ready streaming text-to-speech
// Uses optimized defaults for seamless audio playback

// No external dependencies needed - self-contained streaming implementation


interface TTSChunk {
    id: string;
    text: string;
    position: number;
    tokens: number;
    audio?: HTMLAudioElement;
    ready: boolean;
    generationStartTime?: number;
    generationDuration?: number;
    error?: string;
}

interface StreamingMetrics {
    avgGenerationTime: number;  // ms per 1000 tokens
    avgAudioDuration: number;   // ms per 1000 tokens  
    totalChunks: number;
    successfulChunks: number;
    networkLatency: number;
}

interface StreamingConfig {
    firstChunkTokens: number;
    streamingChunkTokens: number;
    lastChunkTokens: number;
    triggerBufferMs: number;
    safetyMarginMs: number;
    maxConcurrentGenerations: number;
    retryDelayMs: number;
    adaptiveLearningWindow: number;
}

export class TTSStreamingService {
    private chunks: TTSChunk[] = [];
    private audioQueue: (TTSChunk | null)[] = [];
    private currentPlayingIndex = -1;
    private currentAudio: HTMLAudioElement | null = null;
    private isStreaming = false;
    private processingChunks = new Set<number>();
    
    private metrics: StreamingMetrics = {
        avgGenerationTime: 1500,  // Initial estimate: 1.5s per 1000 tokens
        avgAudioDuration: 8000,   // Initial estimate: 8s audio per 1000 tokens
        totalChunks: 0,
        successfulChunks: 0,
        networkLatency: 300
    };
    
    // Optimized defaults - no user configuration needed
    private config: StreamingConfig = {
        firstChunkTokens: 500,      // ~30 words for quick start
        streamingChunkTokens: 1500, // ~100 words for quality
        lastChunkTokens: 2000,      // ~150 words for efficiency
        triggerBufferMs: 2000,      // Start next 2s before current ends
        safetyMarginMs: 500,        // Network safety buffer
        maxConcurrentGenerations: 2, // Max parallel API calls
        retryDelayMs: 1000,         // Retry failed chunks after 1s
        adaptiveLearningWindow: 5   // Learn from last 5 chunks
    };

    private monitoringInterval: number | null = null;
    private onChunkReady?: (chunk: TTSChunk) => void;
    private onPlaybackStart?: (chunk: TTSChunk) => void;
    private onPlaybackEnd?: (chunk: TTSChunk) => void;
    private onError?: (error: string, chunk?: TTSChunk) => void;

    constructor(
        private openaiApiKey: string,
        private voice: string = 'alloy',
        private speed: number = 1.0
    ) {}

    // Main public interface
    async startStreaming(text: string, callbacks?: {
        onChunkReady?: (chunk: TTSChunk) => void;
        onPlaybackStart?: (chunk: TTSChunk) => void;
        onPlaybackEnd?: (chunk: TTSChunk) => void;
        onError?: (error: string, chunk?: TTSChunk) => void;
    }): Promise<void> {
        this.onChunkReady = callbacks?.onChunkReady;
        this.onPlaybackStart = callbacks?.onPlaybackStart;
        this.onPlaybackEnd = callbacks?.onPlaybackEnd;
        this.onError = callbacks?.onError;

        try {
            // 1. Intelligent text chunking
            this.chunks = this.intelligentChunking(text);
            this.audioQueue = new Array(this.chunks.length).fill(null);
            
            // 2. Start first chunk generation immediately for lowest latency
            this.triggerGeneration(0);
            
            // 3. Start playback monitoring
            this.startPlaybackMonitoring();
            
            // 4. Pre-generate second chunk if exists
            if (this.chunks.length > 1) {
                setTimeout(() => this.triggerGeneration(1), 100);
            }
            
        } catch (error) {
            this.onError?.(`Failed to start streaming: ${error.message}`);
            throw error;
        }
    }

    stopStreaming(): void {
        this.isStreaming = false;
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Clean up audio URLs to prevent memory leaks
        this.chunks.forEach(chunk => {
            if (chunk.audio) {
                URL.revokeObjectURL(chunk.audio.src);
            }
        });
        
        this.reset();
    }

    pauseStreaming(): void {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            // Keep isStreaming true so we can resume
        }
    }

    resumeStreaming(): void {
        if (this.currentAudio && this.currentAudio.paused) {
            this.currentAudio.play().catch(error => {
                this.onError?.(`Resume playback failed: ${error.message}`);
            });
        }
    }

    private reset(): void {
        this.chunks = [];
        this.audioQueue = [];
        this.currentPlayingIndex = -1;
        this.currentAudio = null;
        this.processingChunks.clear();
    }

    // INTELLIGENT TEXT CHUNKING
    private intelligentChunking(text: string): TTSChunk[] {
        const normalizedText = this.normalizeText(text);
        const baseChunks = this.hierarchicalChunk(normalizedText);
        
        return baseChunks.map((chunkText, index) => ({
            id: `chunk_${index}`,
            text: chunkText,
            position: index,
            tokens: this.estimateTokens(chunkText),
            ready: false
        }));
    }

    private normalizeText(text: string): string {
        return text
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/([.!?])\s*([A-Z])/g, '$1 $2')  // Ensure space after sentences
            .replace(/([.!?])\s*$/g, '$1')  // Clean ending
            .trim();
    }

    private hierarchicalChunk(text: string): string[] {
        const chunks: string[] = [];
        
        // Splitting hierarchy for natural speech breaks
        const splitters = [
            { pattern: /\n\s*\n/, name: 'paragraph' },
            { pattern: /[.!?]+\s+/, name: 'sentence' },
            { pattern: /[;:]\s+/, name: 'clause' },
            { pattern: /,\s+(and|but|or|however|therefore|meanwhile|furthermore|moreover)\s+/gi, name: 'conjunction' },
            { pattern: /,\s+/, name: 'comma' },
        ];

        const processChunk = (textChunk: string, position: number): string[] => {
            const targetSize = this.getOptimalChunkSize(position);
            
            if (this.estimateTokens(textChunk) <= targetSize) {
                return [textChunk];
            }

            // Try each splitter in order of preference
            for (const splitter of splitters) {
                const parts = textChunk.split(splitter.pattern).filter(part => part.trim());
                
                if (parts.length > 1) {
                    // Successfully split, now combine parts optimally
                    return this.combinePartsOptimally(parts, targetSize);
                }
            }

            // Fallback: word-based splitting
            return this.wordBasedChunk(textChunk, targetSize);
        };

        return this.recursiveChunk(text, 0);
    }

    private recursiveChunk(text: string, position: number): string[] {
        const targetSize = this.getOptimalChunkSize(position);
        
        if (this.estimateTokens(text) <= targetSize) {
            return [text];
        }

        // Find best split point
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const result: string[] = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
            
            if (this.estimateTokens(testChunk) <= targetSize) {
                currentChunk = testChunk;
            } else {
                if (currentChunk) {
                    result.push(currentChunk);
                    currentChunk = sentence;
                } else {
                    // Single sentence too long, split at clause level
                    const clauses = this.splitAtClauses(sentence, targetSize);
                    result.push(...clauses);
                }
            }
        }

        if (currentChunk) {
            result.push(currentChunk);
        }

        return result;
    }

    private splitAtClauses(sentence: string, maxTokens: number): string[] {
        const clausePattern = /[;:]|,\s+(and|but|or|however|therefore|meanwhile)\s+/gi;
        const clauses = sentence.split(clausePattern).filter(c => c.trim());
        
        if (clauses.length <= 1) {
            return this.wordBasedChunk(sentence, maxTokens);
        }

        return this.combinePartsOptimally(clauses, maxTokens);
    }

    private combinePartsOptimally(parts: string[], maxTokens: number): string[] {
        const result: string[] = [];
        let currentChunk = '';

        for (const part of parts) {
            const testChunk = currentChunk + (currentChunk ? ' ' : '') + part;
            
            if (this.estimateTokens(testChunk) <= maxTokens) {
                currentChunk = testChunk;
            } else {
                if (currentChunk) result.push(currentChunk);
                currentChunk = part;
            }
        }

        if (currentChunk) result.push(currentChunk);
        return result;
    }

    private wordBasedChunk(text: string, maxTokens: number): string[] {
        const words = text.split(/\s+/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const word of words) {
            const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
            
            if (this.estimateTokens(testChunk) <= maxTokens) {
                currentChunk = testChunk;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = word;
            }
        }

        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    }

    private getOptimalChunkSize(position: number): number {
        const totalChunks = this.chunks?.length || 1;
        
        if (position === 0) return this.config.firstChunkTokens;
        if (position === totalChunks - 1) return this.config.lastChunkTokens;
        return this.config.streamingChunkTokens;
    }

    private estimateTokens(text: string): number {
        // Rough estimation: ~4 characters per token for English
        return Math.ceil(text.length / 4);
    }

    // PREDICTIVE GENERATION & TIMING
    private async triggerGeneration(position: number): Promise<void> {
        if (this.processingChunks.has(position) || 
            this.processingChunks.size >= this.config.maxConcurrentGenerations) {
            return;
        }

        const chunk = this.chunks[position];
        if (!chunk || chunk.ready) return;

        this.processingChunks.add(position);
        chunk.generationStartTime = Date.now();

        try {
            const audioBlob = await this.generateTTS(chunk.text);
            const audio = new Audio(URL.createObjectURL(audioBlob));
            audio.preload = 'auto';

            // Wait for audio metadata to load
            await new Promise<void>((resolve, reject) => {
                audio.addEventListener('loadedmetadata', () => resolve());
                audio.addEventListener('error', reject);
                audio.load();
            });

            chunk.audio = audio;
            chunk.ready = true;
            chunk.generationDuration = Date.now() - chunk.generationStartTime!;
            
            this.audioQueue[position] = chunk;
            this.updateMetrics(chunk);
            this.onChunkReady?.(chunk);

            // Try to start playback if this is the next needed chunk
            this.tryStartNextAudio();

        } catch (error) {
            chunk.error = error.message;
            this.onError?.(`Generation failed for chunk ${position}: ${error.message}`, chunk);
            
            // Retry logic
            setTimeout(() => {
                this.processingChunks.delete(position);
                chunk.ready = false;
                delete chunk.error;
                this.triggerGeneration(position);
            }, this.config.retryDelayMs);
        }

        this.processingChunks.delete(position);
    }

    private async generateTTS(text: string): Promise<Blob> {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: this.voice,
                speed: this.speed,
                response_format: 'mp3'
            }),
        });

        if (!response.ok) {
            throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
        }

        return await response.blob();
    }

    private updateMetrics(chunk: TTSChunk): void {
        if (!chunk.generationDuration || !chunk.audio) return;

        const tokenCount = chunk.tokens;
        const generationTime = chunk.generationDuration;
        const audioDuration = chunk.audio.duration * 1000;

        // Exponential moving average with adaptive learning
        const alpha = 0.3;
        
        this.metrics.avgGenerationTime = 
            alpha * (generationTime / tokenCount * 1000) + 
            (1 - alpha) * this.metrics.avgGenerationTime;
        
        this.metrics.avgAudioDuration = 
            alpha * (audioDuration / tokenCount * 1000) + 
            (1 - alpha) * this.metrics.avgAudioDuration;

        this.metrics.totalChunks++;
        this.metrics.successfulChunks++;
    }

    // PLAYBACK ORCHESTRATION
    private startPlaybackMonitoring(): void {
        this.monitoringInterval = setInterval(() => {
            this.checkPlaybackTiming();
        }, 100) as unknown as number;
    }

    private checkPlaybackTiming(): void {
        // Try to start next audio if current finished or not started
        if (!this.currentAudio || this.currentAudio.ended) {
            this.tryStartNextAudio();
            return;
        }

        // Check if we should trigger next generation
        if (this.shouldTriggerNextGeneration()) {
            this.triggerNextGeneration();
        }
    }

    private shouldTriggerNextGeneration(): boolean {
        if (!this.currentAudio) return false;

        const currentDuration = this.currentAudio.duration * 1000;
        const currentTime = this.currentAudio.currentTime * 1000;
        const timeRemaining = currentDuration - currentTime;

        // Find next chunk that needs generation
        const nextGenerationIndex = this.findNextGenerationIndex();
        if (nextGenerationIndex === -1) return false;

        const nextChunk = this.chunks[nextGenerationIndex];
        const expectedGenTime = this.estimateGenerationTime(nextChunk.tokens);

        return timeRemaining <= (expectedGenTime + this.config.safetyMarginMs);
    }

    private findNextGenerationIndex(): number {
        for (let i = this.currentPlayingIndex + 1; i < this.chunks.length; i++) {
            if (!this.chunks[i].ready && !this.processingChunks.has(i)) {
                return i;
            }
        }
        return -1;
    }

    private triggerNextGeneration(): void {
        const nextIndex = this.findNextGenerationIndex();
        if (nextIndex !== -1) {
            this.triggerGeneration(nextIndex);
        }
    }

    private estimateGenerationTime(tokens: number): number {
        return (tokens / 1000) * this.metrics.avgGenerationTime + this.metrics.networkLatency;
    }

    private tryStartNextAudio(): void {
        const nextIndex = this.currentPlayingIndex + 1;
        
        if (nextIndex >= this.chunks.length) {
            // All done
            this.isStreaming = false;
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
            return;
        }

        const nextChunk = this.audioQueue[nextIndex];
        if (nextChunk && nextChunk.ready && nextChunk.audio) {
            this.playAudio(nextChunk);
        }
    }

    private playAudio(chunk: TTSChunk): void {
        if (!chunk.audio) return;

        this.currentAudio = chunk.audio;
        this.currentPlayingIndex = chunk.position;
        this.isStreaming = true;

        this.onPlaybackStart?.(chunk);

        chunk.audio.play().catch(error => {
            this.onError?.(`Playback failed for chunk ${chunk.position}: ${error.message}`, chunk);
        });

        chunk.audio.addEventListener('ended', () => {
            this.onPlaybackEnd?.(chunk);
            this.tryStartNextAudio();
        });

        chunk.audio.addEventListener('error', (e) => {
            this.onError?.(`Audio error for chunk ${chunk.position}: ${e}`, chunk);
            this.tryStartNextAudio(); // Try to continue with next chunk
        });
    }

    // Public getters for monitoring
    getMetrics(): StreamingMetrics {
        return { ...this.metrics };
    }

    getProgress(): { current: number; total: number; bufferHealth: number } {
        const readyChunks = this.audioQueue.filter(chunk => chunk?.ready).length;
        const bufferHealth = readyChunks / Math.min(3, this.chunks.length); // Target 3 chunks ahead
        
        return {
            current: this.currentPlayingIndex + 1,
            total: this.chunks.length,
            bufferHealth
        };
    }

    isCurrentlyPlaying(): boolean {
        return this.isStreaming && !!this.currentAudio && !this.currentAudio.paused;
    }
} 