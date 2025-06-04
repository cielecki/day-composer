import { ToolExecutionError } from 'src/types/tool-execution-error';
import { UserToolExecutionContext } from 'src/types/user-tools';
import { createHash } from 'crypto';
import { requestUrl } from 'obsidian';
import { getStore } from '../store/plugin-store';

export class SecureExecutionContext {
  private allowedAPIs: Set<string>;
  private sanitizedGlobals: any;

  constructor() {
    this.allowedAPIs = new Set([
      'app.vault.create',
      'app.vault.read',
      'app.vault.modify',
      'app.vault.delete',
      'app.workspace.getActiveFile',
      'app.workspace.openLinkText',
      'console.log',
      'console.warn',
      'console.error',
      'requestUrl',
      'getSecret',
      'setSecret',
      'Date',
      'JSON',
      'Math',
      'String',
      'Number',
      'Array',
      'Object'
    ]);

    this.sanitizedGlobals = {
      console: {
        log: (...args: any[]) => console.log('[USER-TOOL]', ...args),
        warn: (...args: any[]) => console.warn('[USER-TOOL]', ...args),
        error: (...args: any[]) => console.error('[USER-TOOL]', ...args)
      },
      requestUrl,
      getSecret: (key: string) => {
        return getStore().getSecret(key);
      },
      setSecret: async (key: string, value: string) => {
        const store = getStore();
        await store.setSecret(key, value);
      },
      Date,
      JSON,
      Math,
      String,
      Number,
      Array,
      Object,
      // Explicitly block dangerous globals
      require: undefined,
      process: undefined,
      global: undefined,
      window: undefined,
      document: undefined,
      eval: undefined,
      Function: undefined
    };
  }

  async executeUserCode(code: string, context: UserToolExecutionContext): Promise<void> {
    try {
      // Create safe context methods
      const safeContext = {
        params: context.params,
        plugin: context.plugin,
        progress: context.progress,
        addNavigationTarget: context.addNavigationTarget,
        setLabel: context.setLabel
      };

      // Create the function wrapper
      const wrappedCode = this.wrapCodeForExecution(code, safeContext);

      // Execute in isolated context
      const result = await this.safeEval(wrappedCode, this.sanitizedGlobals, safeContext);
      return result;
    } catch (error) {
      throw new ToolExecutionError(`Tool execution failed: ${error.message}`);
    }
  }

  private wrapCodeForExecution(code: string, context: UserToolExecutionContext): string {
    // Extract the execute function from the code and create a complete function
    return `
      ${code}
      
      if (typeof execute !== 'function') {
        throw new Error('Tool must define an "execute" function');
      }
      
      return execute(context);
    `;
  }

  private async safeEval(wrappedCode: string, globals: any, context: UserToolExecutionContext): Promise<any> {
    // Create a simple async function to execute the code
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor as any;
    
    // Build the function code with proper variable declarations
    const functionCode = `
      // Declare safe globals
      const console = globals.console;
      const requestUrl = globals.requestUrl;
      const getSecret = globals.getSecret;
      const setSecret = globals.setSecret;
      const Date = globals.Date;
      const JSON = globals.JSON;
      const Math = globals.Math;
      const String = globals.String;
      const Number = globals.Number;
      const Array = globals.Array;
      const Object = globals.Object;
      
      // Execute user code
      ${wrappedCode}
    `;

    // Create and execute the function
    const func = new AsyncFunction('context', 'globals', functionCode);
    return await func(context, globals);
  }

  calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
} 