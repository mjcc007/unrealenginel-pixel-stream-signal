import Websocket from "ws";
import EventEmitter from "eventemitter3";
import { MsgBase } from "../common";

export interface EngineServerOpt {
  port: number;
}

export interface EngineServerEvent {
  onMsg: (data: MsgBase) => void;
  onEngineClose: () => void;
  onStart: () => void;
  onStop: () => void;
}

export class EngineServer extends EventEmitter<EngineServerEvent> {
  private _server!: Websocket.Server;
  private _opt: EngineServerOpt = { port: 8888 };
  //   private _clients: Websocket.WebSocket[] = [];
  private _client: Websocket.WebSocket | null = null;

  constructor(opt: EngineServerOpt) {
    super();
    this._opt = { ...this._opt, ...opt };
  }

  start() {
    this._server = new Websocket.Server(
      {
        port: this._opt.port,
      },
      () => {
        console.log("signaling for engine on port:", this._opt.port);
      }
    );

    this._server.on("connection", (ws, req) => {
      //   this._clients.push(ws);
      this._client?.close() && (this._client = null);

      this._client = ws;
      console.log(
        `A New Engine connected:  ${req.socket.remoteAddress}:${req.socket.remotePort}`
      );

      this.setUpWs(ws);
    });
  }

  send(data: any) {
    if (!this._client || this._client.readyState !== Websocket.OPEN) {
      return;
    }
    this._client.send(data);
  }

  private setUpWs(ws: Websocket.WebSocket) {
    ws.on("message", (msg) => {
      this.onMsg(ws, msg);
    });

    ws.on("error", (error) => {
      console.error("! Engine connection error:", error);
    });

    ws.on("close", (code, reason) => {
      console.log("Engine closed:", String(reason));
      this.emit("onEngineClose");
    });

    ws.send(
      JSON.stringify({
        type: "config",
        peerConnectionOptions: {
          // iceServers: [{
          //     urls: [
          //       "stun:stun.l.google.com:19302",
          //       "stun:stun1.l.google.com:19302",
          //       "stun:stun2.l.google.com:19302",
          //       "stun:stun3.l.google.com:19302",
          //       "stun:stun4.l.google.com:19302",
          // ],},],
        },
      })
    );

    this.emit("onStart");
  }

  private onMsg(ws: Websocket.WebSocket, msg: unknown) {
    let data: MsgBase;
    try {
      data = JSON.parse(msg as string);
    } catch (err) {
      console.error("? Engine:", msg);
      return;
    }

    const playerId = String(data.playerId || "");
    console.log("Engine:", data.type, playerId);

    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", time: data.time }));
      return;
    } else if (
      ["offer", "answer", "iceCandidate", "disconnectPlayer"].includes(
        data.type
      )
    ) {
      this.emit("onMsg", data);
    } else {
      console.error("? invalid Engine message type:", data.type);
    }
  }

  stop() {
    this._server.close();
    this.emit("onStop");
  }
}
