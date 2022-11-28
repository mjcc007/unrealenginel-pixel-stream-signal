import { PlayerServer } from "./player-server/index";
import { EngineServer } from "./engine-server/index";
const engineServer = new EngineServer({ port: 8888 });
engineServer.start();

const playerServer = new PlayerServer({ port: 88 });
playerServer.start();

/** ************* engine event **************** */
engineServer.on("onMsg", (data) => {
  const id = String(data.playerId);
  if (["offer", "answer", "iceCandidate"].includes(data.type)) {
    delete data.playerId;
    playerServer.sendToPlayer(JSON.stringify(data), id);
  } else if (data.type === "disconnectPlayer") {
    playerServer.sendToPlayer(data.reason, id);
    playerServer.closePlayer(id);
  }
});

engineServer.on("onStart", () => {
  playerServer.sendAll(`Engine started`);
  playerServer.closeAll();
});

engineServer.on("onEngineClose", () => {
  playerServer.sendAll(`Engine stopped`);
});

/**************** player event **************** */
playerServer.on("onPlayerConnect", (id) => {
  engineServer.send(
    JSON.stringify({
      type: "playerConnected",
      playerId: id,
      dataChannel: true,
      sfu: false,
    })
  );
});

playerServer.on("onMsg", (msg) => {
  if (["answer", "iceCandidate"].includes(msg.type)) {
    engineServer.send(JSON.stringify(msg));
  }
});

playerServer.on("onPlayerStop", (id) => {
  engineServer.send(
    JSON.stringify({ type: "playerDisconnected", playerId: id })
  );
});
