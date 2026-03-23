export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

class ConsoleLogger implements Logger {
  private write(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void {
    const serializedMetadata = metadata ? ` ${JSON.stringify(metadata)}` : '';
    const formattedMessage = `[${level.toUpperCase()}] ${message}${serializedMetadata}`;

    if (level === 'error') {
      console.error(formattedMessage);
      return;
    }

    if (level === 'warn') {
      console.warn(formattedMessage);
      return;
    }

    console.log(formattedMessage);
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.write('debug', message, metadata);
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.write('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.write('warn', message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.write('error', message, metadata);
  }
}

export const logger: Logger = new ConsoleLogger();
