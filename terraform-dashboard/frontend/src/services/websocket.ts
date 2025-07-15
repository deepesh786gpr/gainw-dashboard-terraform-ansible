import { store } from '../store';
import { updateDeploymentStatus, addOperationLog } from '../store/slices/deploymentSlice';
import { updateInstanceState } from '../store/slices/instanceSlice';
import { addNotification } from '../store/slices/notificationSlice';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private messageQueue: WebSocketMessage[] = [];
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(private url: string) {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  private setupEventListeners() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.processMessageQueue();
      
      // Notify store of connection
      store.dispatch(addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Real-time updates enabled',
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnecting = false;
      this.stopHeartbeat();
      
      if (!event.wasClean) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
    };
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('WebSocket message received:', message);

    // Emit to custom listeners
    const listeners = this.eventListeners.get(message.type) || [];
    listeners.forEach(listener => listener(message.payload));

    // Handle built-in message types
    switch (message.type) {
      case 'deployment_status_update':
        store.dispatch(updateDeploymentStatus({
          id: message.payload.deploymentId,
          status: message.payload.status,
        }));
        
        store.dispatch(addNotification({
          type: message.payload.status === 'error' ? 'error' : 'info',
          title: 'Deployment Update',
          message: `Deployment ${message.payload.deploymentId} is now ${message.payload.status}`,
        }));
        break;

      case 'operation_log':
        store.dispatch(addOperationLog({
          operationId: message.payload.operationId,
          log: message.payload.log,
        }));
        break;

      case 'instance_state_change':
        store.dispatch(updateInstanceState({
          id: message.payload.instanceId,
          newState: message.payload.state,
        }));
        
        store.dispatch(addNotification({
          type: 'info',
          title: 'Instance Update',
          message: `Instance ${message.payload.instanceId} is now ${message.payload.state}`,
        }));
        break;

      case 'system_notification':
        store.dispatch(addNotification({
          type: message.payload.type || 'info',
          title: message.payload.title,
          message: message.payload.message,
          persistent: message.payload.persistent,
        }));
        break;

      case 'heartbeat':
        // Respond to heartbeat
        this.send({ type: 'heartbeat_response', payload: {}, timestamp: new Date().toISOString() });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      store.dispatch(addNotification({
        type: 'error',
        title: 'Connection Lost',
        message: 'Unable to reconnect to real-time updates',
        persistent: true,
      }));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          payload: {},
          timestamp: new Date().toISOString(),
        });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  public send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      
      // Try to reconnect if not connected
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  public subscribe(eventType: string, callback: Function) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  public unsubscribe(eventType: string, callback?: Function) {
    if (callback) {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this.eventListeners.delete(eventType);
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getReadyState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}

// Create singleton instance
const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000/ws';
export const websocketService = new WebSocketService(wsUrl);

// Export for use in components
export default websocketService;
