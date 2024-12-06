import { WebSocketServer } from "ws"; // Utiliser WebSocketServer
import type { Server } from "http";
import { MarketService } from "./services/market.service";
import { StrictListService } from "./services/strictList.service";

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server });

  const marketService = new MarketService();
  const strictListService = new StrictListService();

  wss.on("connection", (ws) => {
    console.log("Client connected via WebSocket");

    const interval = setInterval(async () => {
      try {
        // Récupérer toutes les données
        const allMarketsData = await marketService.getMarketsData();
        // Filtrer pour la Strict List
        const strictMarketsData = await strictListService.getStrictMarketsData();

        // Envoyer les deux ensembles de données
        ws.send(
          JSON.stringify({
            all: allMarketsData,
            strict: strictMarketsData,
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
    }, 10000); // Rafraîchir toutes les secondes

    ws.on("close", () => {
      console.log("Client disconnected");
      clearInterval(interval);
    });
  });
}
