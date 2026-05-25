import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { WsEvent } from '@medical-tracker/shared-types';
import { userEventsChannel } from '@medical-tracker/shared-types';

import { TokenService } from '../auth/token.service.js';

/**
 * Socket.IO gateway for real-time user events (OCR progress, notifications).
 * Clients authenticate by sending their Bearer token in the handshake auth:
 *   socket = io(url, { auth: { token: 'Bearer <accessToken>' } })
 * On connect the socket joins a room named userEventsChannel(userId).
 * The EventsService broadcasts to that room from anywhere in the app.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(private readonly tokens: TokenService) {}

  handleConnection(client: Socket): void {
    const raw = (client.handshake.auth as Record<string, unknown>)['token'] as string | undefined;
    const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.tokens.verifyAccessToken(token);
      void client.join(userEventsChannel(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // rooms are cleaned up automatically by Socket.IO
  }

  /** Push an event to all sockets for a given user. */
  emitToUser(userId: string, event: WsEvent): void {
    this.server.to(userEventsChannel(userId)).emit('event', event);
  }

  // Keep-alive ping — client sends 'ping', gateway replies 'pong'
  @SubscribeMessage('ping')
  handlePing(client: Socket): void {
    client.emit('pong');
  }
}
