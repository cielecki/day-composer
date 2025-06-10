import { TFile, EventRef } from 'obsidian';
import { LifeNavigatorPlugin } from '../../LifeNavigatorPlugin';

/**
 * Configuration for the file watcher
 */
export interface FileWatcherConfig {
  /** The tag to watch for (e.g., 'ln-mode', 'ln-tool') */
  tag: string;
  /** Function to call when files need to be reloaded */
  reloadFunction: () => Promise<void> | void;
  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;
  /** Debug prefix for console messages */
  debugPrefix?: string;
}

/**
 * Generic file watcher that handles debounced reloading of tagged files
 */
export class FileWatcher {
  private config: Required<FileWatcherConfig>;
  private fileEventRefs: EventRef[] = [];
  private trackedFilePaths: Set<string> = new Set();
  private debounceTimeout: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  constructor(config: FileWatcherConfig) {
    this.config = {
      debounceDelay: 300,
      debugPrefix: 'FileWatcher',
      ...config
    };
  }

  /**
   * Check if a file has the required tag based on the configuration
   */
  private hasTag(file: TFile): boolean {
    const metadata = LifeNavigatorPlugin.getInstance().app.metadataCache.getFileCache(file);
    const frontmatterTags = metadata?.frontmatter?.tags || [];

    // Convert frontmatter tags to array if it's a string
    const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
      ? frontmatterTags
      : [frontmatterTags];

    // Check if the file has the required tag
    if (normalizedFrontmatterTags.includes(this.config.tag)) {
      return true;
    }

    // Also check if this file was previously tracked (important for detecting deletions/changes)
    if (this.trackedFilePaths.has(file.path)) {
      return true;
    }

    return false;
  }

  /**
   * Debounced version of the reload function
   */
  private debouncedReload(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    this.debounceTimeout = setTimeout(async () => {
      try {
        await this.config.reloadFunction();
        console.debug(`[${this.config.debugPrefix}] Debounced reload completed`);
      } catch (error) {
        console.error(`[${this.config.debugPrefix}] Debounced reload failed:`, error);
      } finally {
        this.debounceTimeout = null;
      }
    }, this.config.debounceDelay);
  }

  /**
   * Start watching for file changes
   */
  start(): void {
    if (this.isActive) {
      console.warn(`[${this.config.debugPrefix}] File watcher already active`);
      return;
    }

    this.cleanup(); // Clean up any existing event references
    
    const plugin = LifeNavigatorPlugin.getInstance();
    
    // When a file is created
    const createRef = plugin.app.vault.on("create", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        // Wait for metadata to be indexed
        setTimeout(() => {
          if (this.hasTag(file)) {
            this.debouncedReload();
          }
        }, 100);
      }
    });
    this.fileEventRefs.push(createRef);

    // When a file is modified
    const modifyRef = plugin.app.vault.on("modify", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        // Check if this file had or has the tag
        const hadTag = this.trackedFilePaths.has(file.path);

        // Wait for metadata to be indexed
        setTimeout(() => {
          const hasTag = this.hasTag(file);
          if (hadTag || hasTag) {
            this.debouncedReload();
          }
        }, 100);
      }
    });
    this.fileEventRefs.push(modifyRef);

    // When a file is deleted
    const deleteRef = plugin.app.vault.on("delete", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        // Check if this was a tracked file
        const wasTracked = this.trackedFilePaths.has(file.path);
        console.debug(`[${this.config.debugPrefix}] File deleted: ${file.path}, was tracked: ${wasTracked}`);
        
        if (wasTracked) {
          console.debug(`[${this.config.debugPrefix}] Reloading after tracked file deletion`);
          this.debouncedReload();
        }
      }
    });
    this.fileEventRefs.push(deleteRef);

    // When a file is renamed
    const renameRef = plugin.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile && file.extension === "md") {
        // Check if this was a tracked file
        const wasTracked = this.trackedFilePaths.has(oldPath);
        
        if (wasTracked) {
          this.debouncedReload();
        } else {
          // Wait for metadata to be indexed
          setTimeout(() => {
            if (this.hasTag(file)) {
              this.debouncedReload();
            }
          }, 100);
        }
      }
    });
    this.fileEventRefs.push(renameRef);

    // When metadata is changed
    const metadataRef = plugin.app.metadataCache.on("changed", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        // Check if this file had the tag before
        const hadTag = this.trackedFilePaths.has(file.path);
        const hasTag = this.hasTag(file);

        // Only reload if tag status changed
        if (hadTag !== hasTag) {
          this.debouncedReload();
        }
      }
    });
    this.fileEventRefs.push(metadataRef);
    
    this.isActive = true;
    console.debug(`[${this.config.debugPrefix}] File watcher started`);
  }

  /**
   * Stop watching for file changes and cleanup
   */
  stop(): void {
    this.cleanup();
    this.isActive = false;
    console.debug(`[${this.config.debugPrefix}] File watcher stopped`);
  }

  /**
   * Update the set of tracked file paths
   */
  updateTrackedPaths(filePaths: string[]): void {
    this.trackedFilePaths = new Set(filePaths);
  }

  /**
   * Get the current set of tracked file paths
   */
  getTrackedPaths(): Set<string> {
    return new Set(this.trackedFilePaths);
  }

  /**
   * Check if the watcher is active
   */
  isWatcherActive(): boolean {
    return this.isActive;
  }

  /**
   * Clean up event listeners and timeouts
   */
  private cleanup(): void {
    // Clear any pending debounced reload
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    
    // Clean up file event listeners
    this.fileEventRefs.forEach((ref) => {
      const plugin = LifeNavigatorPlugin.getInstance();
      if (plugin?.app?.vault) {
        plugin.app.vault.offref(ref);
      }
    });
    this.fileEventRefs = [];
  }
} 