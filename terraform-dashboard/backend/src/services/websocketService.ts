import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastHeartbeat: Date;
  metadata: Record<string, any>;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  private rooms: Map<string, Set<string>> = new Map(); // room -> client IDs

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: false,
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    
    logger.info('WebSocket service initialized');
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = uuidv4();
      const client: ConnectedClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastHeartbeat: new Date(),
        metadata: {
          ip: request.socket.remoteAddress,
          userAgent: request.headers['user-agent'],
          connectedAt: new Date(),
        },
      };

      this.clients.set(clientId, client);
      
      logger.info('WebSocket client connected', {
        clientId,
        ip: client.metadata.ip,
        totalClients: this.clients.size,
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection_established',
        payload: { clientId },
        timestamp: new Date().toISOString(),
      });

      // Setup client event handlers
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          logger.error('Error parsing WebSocket message', { clientId, error });
        }
      });

      ws.on('close', (code, reason) => {
        this.handleClientDisconnect(clientId, code, reason.toString());
      });

      ws.on('error', (error) => {
        logger.error('WebSocket client error', { clientId, error });
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastHeartbeat = new Date();
        }
      });
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error });
    });
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.debug('WebSocket message received', { clientId, type: message.type });

    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(clientId, message.payload);
        break;

      case 'subscribe':
        this.handleSubscription(clientId, message.payload);
        break;

      case 'unsubscribe':
        this.handleUnsubscription(clientId, message.payload);
        break;

      case 'join_room':
        this.handleJoinRoom(clientId, message.payload.room);
        break;

      case 'leave_room':
        this.handleLeaveRoom(clientId, message.payload.room);
        break;

      case 'heartbeat_response':
        client.lastHeartbeat = new Date();
        break;

      case 'deployment_subscribe':
        this.subscribeToDeployment(clientId, message.payload.deploymentId);
        break;

      case 'instance_subscribe':
        this.subscribeToInstance(clientId, message.payload.instanceId);
        break;

      default:
        logger.warn('Unknown WebSocket message type', { clientId, type: message.type });
    }
  }

  private handleAuthentication(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // TODO: Verify JWT token
    client.userId = payload.userId;
    client.metadata.authenticated = true;

    this.sendToClient(clientId, {
      type: 'authentication_success',
      payload: { userId: payload.userId },
      timestamp: new Date().toISOString(),
    });

    logger.info('WebSocket client authenticated', { clientId, userId: payload.userId });
  }

  private handleSubscription(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { eventType } = payload;
    client.subscriptions.add(eventType);

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      payload: { eventType },
      timestamp: new Date().toISOString(),
    });

    logger.debug('Client subscribed to event', { clientId, eventType });
  }

  private handleUnsubscription(clientId: string, payload: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { eventType } = payload;
    client.subscriptions.delete(eventType);

    logger.debug('Client unsubscribed from event', { clientId, eventType });
  }

  private handleJoinRoom(clientId: string, room: string) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(clientId);

    this.sendToClient(clientId, {
      type: 'room_joined',
      payload: { room },
      timestamp: new Date().toISOString(),
    });

    logger.debug('Client joined room', { clientId, room });
  }

  private handleLeaveRoom(clientId: string, room: string) {
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }

    logger.debug('Client left room', { clientId, room });
  }

  private handleClientDisconnect(clientId: string, code: number, reason: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const [room, clients] of this.rooms.entries()) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.rooms.delete(room);
      }
    }

    this.clients.delete(clientId);

    logger.info('WebSocket client disconnected', {
      clientId,
      userId: client.userId,
      code,
      reason,
      totalClients: this.clients.size,
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 60000; // 1 minute timeout

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceLastHeartbeat = now.getTime() - client.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > timeout) {
          logger.warn('Client heartbeat timeout', { clientId });
          client.ws.terminate();
          this.clients.delete(clientId);
        } else {
          // Send ping
          client.ws.ping();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Public methods for sending messages
  public sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Error sending message to client', { clientId, error });
      return false;
    }
  }

  public broadcast(message: WebSocketMessage, filter?: (client: ConnectedClient) => boolean) {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients.entries()) {
      if (filter && !filter(client)) continue;
      
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }

    logger.debug('Broadcast message sent', { type: message.type, sentCount });
    return sentCount;
  }

  public sendToRoom(room: string, message: WebSocketMessage) {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return 0;

    let sentCount = 0;
    for (const clientId of roomClients) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  public sendToUser(userId: string, message: WebSocketMessage) {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  public subscribeToDeployment(clientId: string, deploymentId: string) {
    this.handleJoinRoom(clientId, `deployment:${deploymentId}`);
  }

  public subscribeToInstance(clientId: string, instanceId: string) {
    this.handleJoinRoom(clientId, `instance:${instanceId}`);
  }

  // Notification methods
  public notifyDeploymentUpdate(deploymentId: string, status: string, details?: any) {
    const message: WebSocketMessage = {
      type: 'deployment_status_update',
      payload: { deploymentId, status, details },
      timestamp: new Date().toISOString(),
    };

    this.sendToRoom(`deployment:${deploymentId}`, message);
  }

  public notifyInstanceStateChange(instanceId: string, state: string, details?: any) {
    const message: WebSocketMessage = {
      type: 'instance_state_change',
      payload: { instanceId, state, details },
      timestamp: new Date().toISOString(),
    };

    this.sendToRoom(`instance:${instanceId}`, message);
  }

  public sendOperationLog(operationId: string, log: string) {
    const message: WebSocketMessage = {
      type: 'operation_log',
      payload: { operationId, log },
      timestamp: new Date().toISOString(),
    };

    this.broadcast(message, (client) => 
      client.subscriptions.has('operation_logs') || 
      client.subscriptions.has(`operation:${operationId}`)
    );
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.userId).length,
    };
  }

  public shutdown() {
    clearInterval(this.heartbeatInterval);
    
    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutdown');
    }
    
    this.wss.close();
    logger.info('WebSocket service shutdown');
  }
}

export let websocketService: WebSocketService;
