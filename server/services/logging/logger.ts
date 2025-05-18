/**
 * Logger class for consistent logging throughout the application
 */
export class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  public info(message: string, meta?: any): void {
    console.log(`[${this.context}] ${message}`, meta ? meta : '');
  }
  
  public error(message: string, error?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, error ? error : '');
  }
  
  public warn(message: string, meta?: any): void {
    console.warn(`[${this.context}] WARN: ${message}`, meta ? meta : '');
  }
  
  public debug(message: string, meta?: any): void {
    if (process.env.DEBUG) {
      console.debug(`[${this.context}] DEBUG: ${message}`, meta ? meta : '');
    }
  }
}