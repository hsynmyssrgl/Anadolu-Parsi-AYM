declare module 'electron' {
  export interface WebFrameMain { readonly url: string; }
  export interface IpcMainInvokeEvent {
    readonly sender: { readonly id: number; readonly mainFrame: WebFrameMain };
    readonly senderFrame: WebFrameMain;
  }
  export interface IpcMain {
    handle(
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown
    ): void;
  }
  export const ipcMain: IpcMain;
  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
  };
  export const contextBridge: {
    exposeInMainWorld(key: string, api: unknown): void;
  };
  export const dialog: {
    showOpenDialog(options: unknown): Promise<{ canceled: boolean; filePaths: string[] }>;
    showSaveDialog(options: unknown): Promise<{ canceled: boolean; filePath?: string }>;
  };
  export const shell: {
    openPath(path: string): Promise<string>;
    openExternal(url: string): Promise<void>;
  };
  export class BrowserWindow {
    public static getAllWindows(): BrowserWindow[];
    public constructor(options?: unknown);
    public readonly webContents: {
      readonly id: number;
      readonly mainFrame: WebFrameMain;
      setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' | 'allow' }): void;
      on(event: 'will-navigate', listener: (event: { preventDefault(): void }, url: string) => void): void;
      printToPDF(options: unknown): Promise<Buffer>;
    };
    public once(event: 'ready-to-show' | 'closed', listener: () => void): void;
    public loadURL(url: string): Promise<void>;
    public loadFile(path: string): Promise<void>;
    public show(): void;
    public focus(): void;
    public isMinimized(): boolean;
    public restore(): void;
    public destroy(): void;
  }
  export const app: {
    readonly isPackaged: boolean;
    requestSingleInstanceLock(): boolean;
    enableSandbox(): void;
    quit(): void;
    setAppUserModelId(value: string): void;
    getPath(name: string): string;
    relaunch(): void;
    exit(code?: number): void;
    whenReady(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
  };
}
