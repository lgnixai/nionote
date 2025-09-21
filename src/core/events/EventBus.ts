import { AppEvent, EventListener, EventFilter } from './events';

/**
 * 事件总线 - 实现组件间松耦合通信
 * 基于Obsidian设计原则：支持双向数据流和即时响应
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private globalListeners: Set<EventListener> = new Set();
  private eventHistory: AppEvent[] = [];
  private maxHistorySize = 100;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 发布事件
   * @param event 事件对象
   */
  public emit<T extends AppEvent>(event: Omit<T, 'timestamp'>): void {
    const fullEvent = {
      ...event,
      timestamp: Date.now(),
    } as T;

    // 记录事件历史
    this.addToHistory(fullEvent);

    // 触发特定类型监听器
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(fullEvent);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }

    // 触发全局监听器
    this.globalListeners.forEach(listener => {
      try {
        listener(fullEvent);
      } catch (error) {
        console.error('Error in global event listener:', error);
      }
    });

    // 开发环境下打印事件日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EventBus] ${event.type}:`, fullEvent);
    }
  }

  /**
   * 订阅特定类型事件
   * @param eventType 事件类型
   * @param listener 监听器函数
   * @returns 取消订阅函数
   */
  public on<T extends AppEvent>(
    eventType: T['type'], 
    listener: EventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    const typeListeners = this.listeners.get(eventType)!;
    typeListeners.add(listener as EventListener);

    // 返回取消订阅函数
    return () => {
      typeListeners.delete(listener as EventListener);
      if (typeListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * 订阅所有事件
   * @param listener 监听器函数
   * @returns 取消订阅函数
   */
  public onAll(listener: EventListener): () => void {
    this.globalListeners.add(listener);
    
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * 条件订阅事件
   * @param filter 事件过滤器
   * @param listener 监听器函数
   * @returns 取消订阅函数
   */
  public onWhere<T extends AppEvent>(
    filter: EventFilter<T>,
    listener: EventListener<T>
  ): () => void {
    const wrappedListener = (event: AppEvent) => {
      if (filter(event)) {
        listener(event);
      }
    };

    this.globalListeners.add(wrappedListener);
    
    return () => {
      this.globalListeners.delete(wrappedListener);
    };
  }

  /**
   * 一次性订阅事件
   * @param eventType 事件类型
   * @param listener 监听器函数
   * @returns Promise，在事件触发时resolve
   */
  public once<T extends AppEvent>(
    eventType: T['type']
  ): Promise<T> {
    return new Promise((resolve) => {
      const unsubscribe = this.on(eventType, (event) => {
        unsubscribe();
        resolve(event as T);
      });
    });
  }

  /**
   * 移除所有监听器
   * @param eventType 可选，指定事件类型
   */
  public removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
      this.globalListeners.clear();
    }
  }

  /**
   * 获取事件历史
   * @param eventType 可选，过滤特定类型
   * @param limit 可选，限制数量
   */
  public getEventHistory(eventType?: string, limit?: number): AppEvent[] {
    let history = this.eventHistory;
    
    if (eventType) {
      history = history.filter(event => event.type === eventType);
    }
    
    if (limit) {
      history = history.slice(-limit);
    }
    
    return [...history];
  }

  /**
   * 清空事件历史
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 获取监听器统计信息
   */
  public getStats(): {
    totalListeners: number;
    typeListeners: Record<string, number>;
    globalListeners: number;
    historySize: number;
  } {
    const typeListeners: Record<string, number> = {};
    let totalListeners = this.globalListeners.size;

    this.listeners.forEach((listeners, type) => {
      typeListeners[type] = listeners.size;
      totalListeners += listeners.size;
    });

    return {
      totalListeners,
      typeListeners,
      globalListeners: this.globalListeners.size,
      historySize: this.eventHistory.length,
    };
  }

  /**
   * 添加事件到历史记录
   */
  private addToHistory(event: AppEvent): void {
    this.eventHistory.push(event);
    
    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }
}

// 导出单例实例
export const eventBus = EventBus.getInstance();