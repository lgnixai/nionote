import { eventBus } from '../events/EventBus';
import { FileItem } from '../events/events';

export interface WebSocketMessage {
  type: string;
  id?: string;
  data?: any;
  error?: string;
}

export interface FileOperationMessage extends WebSocketMessage {
  type: 'file-operation';
  operation: 'create' | 'delete' | 'rename' | 'move' | 'update-content';
  file?: FileItem;
  path?: string;
  content?: string;
  oldPath?: string;
  newPath?: string;
}

export interface FileWatchMessage extends WebSocketMessage {
  type: 'file-watch';
  event: 'created' | 'deleted' | 'modified' | 'renamed' | 'moved';
  path: string;
  oldPath?: string;
  content?: string;
}

export class WebSocketClient {
  private static instance: WebSocketClient;
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: WebSocketMessage[] = [];
  private connected = false;
  private listeners: Map<string, ((message: WebSocketMessage) => void)[]> = new Map();

  private constructor(url: string = 'ws://localhost:8080/ws') {
    this.url = url;
    this.connect();
  }

  public static getInstance(url?: string): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient(url);
    }
    return WebSocketClient.instance;
  }

  /**
   * 连接WebSocket服务器
   */
  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 处理连接打开
   */
  private handleOpen(): void {
    console.log('WebSocket connected');
    this.connected = true;
    this.reconnectAttempts = 0;
    
    // 发送队列中的消息
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }

    // 发布连接事件
    eventBus.emit({
      type: 'websocket-connected' as any,
      url: this.url,
    });
  }

  /**
   * 处理接收消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // 处理文件监听事件
      if (message.type === 'file-watch') {
        this.handleFileWatchMessage(message as FileWatchMessage);
      }
      
      // 处理文件操作响应
      if (message.type === 'file-operation-response') {
        this.handleFileOperationResponse(message);
      }

      // 触发注册的监听器
      const typeListeners = this.listeners.get(message.type) || [];
      typeListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error(`Error in WebSocket listener for ${message.type}:`, error);
        }
      });

      // 触发全局监听器
      const globalListeners = this.listeners.get('*') || [];
      globalListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('Error in global WebSocket listener:', error);
        }
      });

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * 处理文件监听消息
   */
  private handleFileWatchMessage(message: FileWatchMessage): void {
    const { event, path, oldPath, content } = message;
    
    switch (event) {
      case 'created':
        // 文件被创建，通知前端更新
        eventBus.emit({
          type: 'file-system-sync' as any,
          operation: 'create',
          path,
          content,
        });
        break;
        
      case 'deleted':
        // 文件被删除
        eventBus.emit({
          type: 'file-system-sync' as any,
          operation: 'delete',
          path,
        });
        break;
        
      case 'modified':
        // 文件内容被修改
        eventBus.emit({
          type: 'file-system-sync' as any,
          operation: 'modify',
          path,
          content,
        });
        break;
        
      case 'renamed':
      case 'moved':
        // 文件被重命名或移动
        eventBus.emit({
          type: 'file-system-sync' as any,
          operation: 'move',
          oldPath,
          newPath: path,
        });
        break;
    }
  }

  /**
   * 处理文件操作响应
   */
  private handleFileOperationResponse(message: WebSocketMessage): void {
    if (message.error) {
      console.error('File operation failed:', message.error);
      // 可以发布错误事件
      eventBus.emit({
        type: 'file-operation-error' as any,
        error: message.error,
        operation: message.data?.operation,
      });
    } else {
      console.log('File operation succeeded:', message.data);
    }
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    console.log('WebSocket connection closed:', event.code, event.reason);
    this.connected = false;
    
    // 发布断开连接事件
    eventBus.emit({
      type: 'websocket-disconnected' as any,
      code: event.code,
      reason: event.reason,
    });

    // 如果不是主动关闭，尝试重连
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理连接错误
   */
  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    
    // 发布错误事件
    eventBus.emit({
      type: 'websocket-error' as any,
      error: error.toString(),
    });
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      this.reconnectAttempts++;
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      eventBus.emit({
        type: 'websocket-reconnect-failed' as any,
        attempts: this.reconnectAttempts,
      });
    }
  }

  /**
   * 发送消息
   */
  public send(message: WebSocketMessage): void {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.messageQueue.push(message);
      }
    } else {
      // 连接未建立，加入队列
      this.messageQueue.push(message);
    }
  }

  /**
   * 注册消息监听器
   */
  public on(messageType: string, listener: (message: WebSocketMessage) => void): () => void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    
    const typeListeners = this.listeners.get(messageType)!;
    typeListeners.push(listener);

    // 返回取消订阅函数
    return () => {
      const index = typeListeners.indexOf(listener);
      if (index !== -1) {
        typeListeners.splice(index, 1);
      }
      
      if (typeListeners.length === 0) {
        this.listeners.delete(messageType);
      }
    };
  }

  /**
   * 文件操作API
   */
  public async createFile(file: FileItem): Promise<void> {
    const message: FileOperationMessage = {
      type: 'file-operation',
      id: Date.now().toString(),
      operation: 'create',
      file,
    };
    
    this.send(message);
  }

  public async deleteFile(path: string): Promise<void> {
    const message: FileOperationMessage = {
      type: 'file-operation',
      id: Date.now().toString(),
      operation: 'delete',
      path,
    };
    
    this.send(message);
  }

  public async renameFile(oldPath: string, newPath: string): Promise<void> {
    const message: FileOperationMessage = {
      type: 'file-operation',
      id: Date.now().toString(),
      operation: 'rename',
      oldPath,
      newPath,
    };
    
    this.send(message);
  }

  public async moveFile(oldPath: string, newPath: string): Promise<void> {
    const message: FileOperationMessage = {
      type: 'file-operation',
      id: Date.now().toString(),
      operation: 'move',
      oldPath,
      newPath,
    };
    
    this.send(message);
  }

  public async updateFileContent(path: string, content: string): Promise<void> {
    const message: FileOperationMessage = {
      type: 'file-operation',
      id: Date.now().toString(),
      operation: 'update-content',
      path,
      content,
    };
    
    this.send(message);
  }

  /**
   * 获取连接状态
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * 关闭连接
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * 重新连接
   */
  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// 导出单例实例
export const webSocketClient = WebSocketClient.getInstance();