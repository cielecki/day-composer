import MyPlugin from "../main";
import { fileExists } from "../utils/fs/file-exists";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { getPluginSettings } from "../settings/PluginSettings";
import { ensureDirectoryExists } from "../utils/fs/ensure-directory-exists";
import { normalizePath } from "obsidian";
import OpenAI from 'openai';
import { t } from "../i18n";

const schema = {
  name: "generate_image",
  description: "Generates an image using OpenAI's GPT-4o image generation model and saves it to the specified path in the vault. Uses the latest gpt-image-1 model for superior instruction following and photorealistic results.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A detailed description of the image to generate. Be specific and descriptive for best results.",
      },
      path: {
        type: "string",
        description: "The path where the image should be saved (including filename with .jpg or .png extension). Directories will be created if they don't exist.",
      },
      size: {
        type: "string",
        description: "Image size. Options: '1024x1024' (square), '1536x1024' (portrait), '1024x1536' (landscape), 'auto' (model decides). Default: '1024x1024'",
        enum: ["1024x1024", "1536x1024", "1024x1536", "auto"]
      },
      quality: {
        type: "string",
        description: "Image quality. Options: 'low', 'medium', 'high', 'auto' (model decides). Default: 'auto'",
        enum: ["low", "medium", "high", "auto"]
      }
    },
    required: ["prompt", "path"]
  }
};

type GenerateImageToolInput = {
  prompt: string;
  path: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
}

export const generateImageTool: ObsidianTool<GenerateImageToolInput> = {
  specification: schema,
  icon: "image",
  initialLabel: t('tools.generateImage.label'),
  execute: async (context: ToolExecutionContext<GenerateImageToolInput>): Promise<void> => {
    const { plugin, params, signal } = context;
    const { prompt, path, size = "1024x1024", quality = "auto" } = params;

    context.setLabel(t('tools.generateImage.generating', { path }));

    // Check abort signal at start
    if (signal.aborted) throw new ToolExecutionError(t('tools.generateImage.errors.aborted'));

    // Validate inputs
    if (!prompt || prompt.trim().length === 0) {
      context.setLabel(t('tools.actions.generateImage.failed', { path }));
      throw new ToolExecutionError(t('tools.generateImage.errors.emptyPrompt'));
    }

    if (!path || path.trim().length === 0) {
      context.setLabel(t('tools.actions.generateImage.failed', { path }));
      throw new ToolExecutionError(t('tools.generateImage.errors.emptyPath'));
    }

    // Ensure path has an image extension
    let normalizedPath = path;
    if (!normalizedPath.match(/\.(jpg|jpeg|png)$/i)) {
      normalizedPath += '.jpg'; // Default to jpg for GPT-4o images
    }

    normalizedPath = normalizePath(normalizedPath);

    // Check if the file already exists
    const exists = await fileExists(normalizedPath, plugin.app);
    if (exists) {
      context.setLabel(t('tools.actions.generateImage.failed', { path: normalizedPath }));
      throw new ToolExecutionError(t('tools.generateImage.errors.fileExists', { path: normalizedPath }));
    }

    // Check for OpenAI API key
    const settings = getPluginSettings();
    if (!settings.openAIApiKey) {
      context.setLabel(t('tools.actions.generateImage.failed', { path: normalizedPath }));
      throw new ToolExecutionError(t('tools.generateImage.errors.noApiKey'));
    }

    // Check abort signal before starting generation
    if (signal.aborted) throw new ToolExecutionError(t('tools.generateImage.errors.aborted'));

    try {
      // Create OpenAI client
      const openai = new OpenAI({
        apiKey: settings.openAIApiKey,
        dangerouslyAllowBrowser: true
      });

      context.progress(t('tools.generateImage.progress.generatingWithModel', { 
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '') 
      }));

      // Generate image using GPT-4o image model with abort signal
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        size: size,
        quality: quality,
        n: 1
      }, {
        signal
      });

      // Check abort signal after API call
      if (signal.aborted) throw new ToolExecutionError(t('tools.generateImage.errors.aborted'));

      if (!response.data || response.data.length === 0) {
        throw new ToolExecutionError(t('tools.generateImage.errors.noImageData'));
      }

      const imageData = response.data[0];
      if (!imageData.b64_json) {
        throw new ToolExecutionError(t('tools.generateImage.errors.noBase64Data'));
      }

      context.progress(t('tools.generateImage.progress.processing'));

      // Check abort signal before processing
      if (signal.aborted) throw new ToolExecutionError(t('tools.generateImage.errors.aborted'));

      // Convert base64 to binary
      const imageBuffer = Buffer.from(imageData.b64_json, 'base64');

      context.progress(t('tools.generateImage.progress.saving'));

      // Ensure directory exists
      const directoryPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
      if (directoryPath) {
        await ensureDirectoryExists(directoryPath, plugin.app);
      }

      // Check abort signal one more time before final save
      if (signal.aborted) throw new ToolExecutionError(t('tools.generateImage.errors.aborted'));

      // Create the binary file using Obsidian's vault API
      await plugin.app.vault.createBinary(normalizedPath, imageBuffer);

      // Add navigation target
      context.addNavigationTarget({
        filePath: normalizedPath,
        description: t('tools.generateImage.openImage')
      });

      context.setLabel(t('tools.generateImage.success', { path: normalizedPath }));
      context.progress(t('tools.generateImage.success', { path: normalizedPath }));

    } catch (error: any) {
      console.error('Error generating image:', error);
      
      context.setLabel(t('tools.actions.generateImage.failed', { path: normalizedPath }));
      
      // Handle abort errors specifically - throw ToolExecutionError for user-facing message
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('Image generation was aborted');
        throw new ToolExecutionError(t('tools.generateImage.errors.aborted'));
      }
      
      if (error instanceof ToolExecutionError) {
        throw error;
      }

      // Handle OpenAI API specific errors
      if (error?.error?.code === 'insufficient_quota') {
        throw new ToolExecutionError(t('tools.generateImage.errors.quotaExceeded'));
      } else if (error?.error?.message) {
        throw new ToolExecutionError(t('tools.generateImage.errors.invalidRequest', { error: error?.error?.message || 'Unknown error' }));
      } else {
        throw new ToolExecutionError(t('tools.generateImage.errors.general', { error: error?.message || String(error) }));
      }
    }
  }
}; 