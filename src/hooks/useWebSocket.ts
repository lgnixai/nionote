import { useEffect, useRef, useCallback } from 'react';
import { webSocketClient } from '@/core/api/WebSocketClient';
import { eventBus } from '@/core/events/EventBus';

export interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = 'ws://localhost:8080/ws',
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options;

  const wsRef = useRef<typeof webSocketClient | null>(null);
  const isConnectedRef = useRef(false);

  // 初始化WebSocket连接
  useEffect(() => {
    if (autoConnect && !wsRef.current) {
      try {
        wsRef.current = webSocketClient;
        isConnectedRef.current = true;

        // 监听连接事件
        const unsubscribeConnected = eventBus.on('websocket-connected', () => {
          isConnectedRef.current = true;
          console.log('WebSocket connected successfully');
        });

        const unsubscribeDisconnected = eventBus.on('websocket-disconnected', () => {
          isConnectedRef.current = false;
          console.log('WebSocket disconnected');
        });

        const unsubscribeError = eventBus.on('websocket-error', (event) => {
          console.error('WebSocket error:', event.error);
        });

        const unsubscribeReconnectFailed = eventBus.on('websocket-reconnect-failed', (event) => {
          console.error(`WebSocket reconnection failed after ${event.attempts} attempts`);
        });

        return () => {
          unsubscribeConnected();
          unsubscribeDisconnected();
          unsubscribeError();
          unsubscribeReconnectFailed();
        };
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
      }
    }
  }, [autoConnect, url]);

  // 发送消息
  const sendMessage = useCallback((type: string, data?: any) => {
    if (wsRef.current) {
      wsRef.current.send({
        type,
        id: Date.now().toString(),
        data,
      });
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // 文件操作方法
  const createFile = useCallback(async (file: any) => {
    if (wsRef.current) {
      return wsRef.current.createFile(file);
    }
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    if (wsRef.current) {
      return wsRef.current.deleteFile(path);
    }
  }, []);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    if (wsRef.current) {
      return wsRef.current.renameFile(oldPath, newPath);
    }
  }, []);

  const moveFile = useCallback(async (oldPath: string, newPath: string) => {
    if (wsRef.current) {
      return wsRef.current.moveFile(oldPath, newPath);
    }
  }, []);

  const updateFileContent = useCallback(async (path: string, content: string) => {
    if (wsRef.current) {
      return wsRef.current.updateFileContent(path, content);
    }
  }, []);

  // 连接状态
  const isConnected = useCallback(() => {
    return wsRef.current?.isConnected() || false;
  }, []);

  // 重新连接
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.reconnect();
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
      isConnectedRef.current = false;
    }
  }, []);

  return {
    sendMessage,
    createFile,
    deleteFile,
    renameFile,
    moveFile,
    updateFileContent,
    isConnected,
    reconnect,
    disconnect,
  };
};