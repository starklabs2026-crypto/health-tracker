/**
 * Websocket (Socket.IO) event contracts shared between API and mobile.
 * In the prototype these substitute for APNS/FCM push (playbook substitution map).
 */

export enum WsEventType {
  OcrStarted = 'ocr_started',
  OcrProgress = 'ocr_progress',
  OcrComplete = 'ocr_complete',
  OcrFailed = 'ocr_failed',
  Notification = 'notification',
}

export interface OcrProgressEvent {
  type: WsEventType.OcrStarted | WsEventType.OcrProgress | WsEventType.OcrComplete | WsEventType.OcrFailed;
  documentId: string;
  /** Present on OcrComplete: how many readings were extracted. */
  extractedCount?: number;
  /** Optional 0-100 progress for OcrProgress. */
  progress?: number;
}

export interface NotificationEvent {
  type: WsEventType.Notification;
  notificationType: string;
  payload: Record<string, unknown>;
}

export type WsEvent = OcrProgressEvent | NotificationEvent;

/** Channel name a worker publishes to for a given user (Redis pub/sub). */
export function userEventsChannel(userId: string): string {
  return `user-events:${userId}`;
}
