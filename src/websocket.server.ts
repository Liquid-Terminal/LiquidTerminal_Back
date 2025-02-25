import { WebSocketServer } from "ws";
import type { Server } from "http";
import { SpotAssetContextService } from "./services/apiHyperliquid/spot/spotAssetContext.service";

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server });

  const marketService = new SpotAssetContextService();

  wss.on("connection", (ws) => {
    console.log("Client connected via WebSocket");

    const interval = setInterval(async () => {
      try {
        // Récupérer toutes les données
        const allMarketsData = await marketService.getMarketsData();

        // Envoyer les données
        ws.send(
          JSON.stringify({
            all: allMarketsData
          })
        );
      } catch (error) {
        console.error("Error fetching market data:", error);
        ws.send(
          JSON.stringify({
            error: "Failed to fetch market data",
          })
        );
      }
    }, 10000); // Rafraîchir toutes les 10 secondes

    ws.on("close", () => {
      console.log("Client disconnected");
      clearInterval(interval);
    });
  });
}
