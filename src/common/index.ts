export interface MsgBase {
  type:
    | "ping"
    | "offer"
    | "answer"
    | "iceCandidate"
    | "disconnectPlayer"
    | "debug";
  playerId?: number | string;
  time: number;
  reason: string;
  debug?: string;
}
