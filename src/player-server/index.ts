import { EventEmitter } from "eventemitter3";
import Websocket from "ws";
import http from "http";
import { MsgBase } from "../common";

export interface PlayerServerOpt {
  port: number;
}

export interface PlayerServerEvent {
  onMsg: (data: MsgBase) => void;
  onStart: () => void;
  onStop: () => void;
  onPlayerStart: (id: string) => void;
  onPlayerStop: (id: string) => void;
  onPlayerConnect: (id: string) => void;
}

export interface PlayerInfo {
  id: string;
  ws: Websocket.WebSocket;
}

export class PlayerServer extends EventEmitter<PlayerServerEvent> {
  private _server!: Websocket.Server;
  private _opt: PlayerServerOpt = { port: 88 };
  private _nextPlayerId = 100;
  private _players: PlayerInfo[] = [];

  constructor(opt: PlayerServerOpt) {
    super();
    this._opt = { ...this._opt, ...opt };
  }

  start() {
    this._server = new Websocket.Server({
      server: http.createServer().listen(this._opt.port || 88, () => {
        console.log("signaling for player: ", this._opt.port || 88);
      }),
      clientTracking: true,
    });

    this._server.on("connection", async (ws, req) => {
      const playerId = String(++this._nextPlayerId);
      console.log(
        "player",
        playerId,
        "connected:",
        req.socket.remoteAddress,
        req.socket.remotePort
      );

      this.setUpWs(ws, playerId);

      this.emit("onPlayerConnect", playerId);
    });
    this.emit("onStart");
  }

  private setUpWs(ws: Websocket.WebSocket, id: string) {
    ws.on("message", (msg) => {
      this.onMsg(ws, msg, id);
    });

    ws.on("error", (error) => {
      console.error(`! player[${id}] connection error:`, error);
    });

    ws.on("close", (code, reason) => {
      console.log(`! player[${id}] closed:`, String(reason));
      this.emit("onPlayerStop", id);
      this._players = this._players.filter((item) => item.id !== id);
    });

    ws.on("open", () => {
      console.log(`🚀 player [${id}] opend!`);
      this.emit("onPlayerStart", id);
    });

    this._players.push({
      id,
      ws,
    });
  }

  sendAll(data: any) {
    this._players.forEach((player) => {
      const client = player.ws;
      if (!client || client.readyState !== Websocket.OPEN) {
        return;
      }
      client.send(data);
    });
  }

  closeAll() {
    this._players.forEach((player) => {
      const client = player.ws;
      if (!client || client.readyState !== Websocket.OPEN) {
        return;
      }
      client.close(1011, "1");
    });
  }

  sendToPlayer(data: any, id: string) {
    const client = this._players.filter((p) => p.id === id)[0];
    if (!client || client.ws.readyState !== Websocket.OPEN) {
      return;
    }

    client.ws.send(data);
  }

  closePlayer(id: string) {
    const client = this._players.filter((p) => p.id === id)[0];
    if (!client || client.ws.readyState !== Websocket.OPEN) {
      return;
    }
    client.ws.close(1011, "Infinity");
    this._players = this._players.filter((p) => p.id !== id);
  }

  private onMsg(ws: Websocket.WebSocket, msg: unknown, id: string) {
    let data: MsgBase;
    try {
      data = JSON.parse(msg as string);
    } catch (err) {
      console.error(`? Player[${id}]:`, msg);
      ws.send("? " + (msg as string).slice(0, 100));
      return;
    }

    const playerId = String(id || "");
    console.log(`Player[${id}]:`, data.type, playerId);
    data.playerId = playerId;

    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", time: data.time }));
      return;
    } else if (data.type === "debug") {
      data.debug || ws.send("【debug】" + String(eval(data.debug as string)));
    } else if (["answer", "iceCandidate"].includes(data.type)) {
      this.emit("onMsg", data);
    } else {
      ws.send("? " + data.type);
    }
  }

  stop() {
    this._server.close();
    this.emit("onStop");
  }
}
