import { WebSocketServer } from "ws";
import type { Server } from "http";
import { SpotAssetContextService } from "./services/market/spot/spotAssetContext.service";
import { PerpAssetContextService } from "./services/market/perp/perpAssetContext.service";

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server });

  const spotMarketService = new SpotAssetContextService();
  const perpMarketService = new PerpAssetContextService();

  wss.on("connection", (ws) => {
    console.log("Client connected via WebSocket");

    const interval = setInterval(async () => {
      try {
        // Récupérer toutes les données
        const [spotMarketsData, perpMarketsData] = await Promise.all([
          spotMarketService.getMarketsData(),
          perpMarketService.getPerpMarketsData()
        ]);

        // Calculer les indices triés pour spot
        const spotSortIndices = {
          volume: spotMarketsData
            .map((_, index) => index)
            .sort((a, b) => spotMarketsData[b].volume - spotMarketsData[a].volume),
          
          marketCap: spotMarketsData
            .map((_, index) => index)
            .sort((a, b) => spotMarketsData[b].marketCap - spotMarketsData[a].marketCap),
          
          change24h: spotMarketsData
            .map((_, index) => index)
            .sort((a, b) => spotMarketsData[b].change24h - spotMarketsData[a].change24h)
        };

        // Calculer les indices triés pour perp
        const perpSortIndices = {
          volume: perpMarketsData
            .map((_, index) => index)
            .sort((a, b) => perpMarketsData[b].volume - perpMarketsData[a].volume),
          
          openInterest: perpMarketsData
            .map((_, index) => index)
            .sort((a, b) => perpMarketsData[b].openInterest - perpMarketsData[a].openInterest),
          
          change24h: perpMarketsData
            .map((_, index) => index)
            .sort((a, b) => perpMarketsData[b].change24h - perpMarketsData[a].change24h)
        };

        // Envoyer les données avec les indices de tri
        ws.send(
          JSON.stringify({
            spot: {
              all: spotMarketsData,
              sortIndices: spotSortIndices
            },
            perp: {
              all: perpMarketsData,
              sortIndices: perpSortIndices
            }
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
