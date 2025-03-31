import { BaseApiService } from "../base/base.api.service";
import { UserTransactionsResponse, FormattedUserTransaction, UserTransaction, NonFundingLedgerUpdate, UserFillsResponse, UserFill } from "../../types/wallet.types";

class RpcApiService extends BaseApiService {
  constructor() {
    super("https://rpc.hyperliquid.xyz/explorer");
  }
}

class HyperliquidApiService extends BaseApiService {
  constructor() {
    super("https://api.hyperliquid.xyz");
  }
}

export class UserTransactionsService {
  private rpcService: RpcApiService;
  private apiService: HyperliquidApiService;

  constructor() {
    this.rpcService = new RpcApiService();
    this.apiService = new HyperliquidApiService();
  }

  async getUserTransactionsRaw(address: string): Promise<UserTransactionsResponse> {
    const response = await this.rpcService.post<UserTransactionsResponse>("", {
      type: "userDetails",
      user: address
    });
    return response;
  }

  async getUserNonFundingLedgerUpdates(address: string): Promise<NonFundingLedgerUpdate[]> {
    const response = await this.apiService.post<NonFundingLedgerUpdate[]>("/info", {
      type: "userNonFundingLedgerUpdates",
      user: address,
      startTime: 1681222254710// On récupère tout l'historique
    });
    return response;
  }

  async getUserFills(address: string): Promise<UserFillsResponse> {
    try {
      const response = await this.apiService.post<UserFillsResponse>("/info", {
        type: "userFills",
        user: address
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  private formatAge(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  private mergeFillsByHash(fills: UserFill[]): UserFill[] {
    if (!fills || !Array.isArray(fills)) {
      return [];
    }

    const fillsByHash = new Map<string, UserFill[]>();
    
    // Grouper les fills par hash
    fills.forEach(fill => {
      if (!fillsByHash.has(fill.hash)) {
        fillsByHash.set(fill.hash, []);
      }
      fillsByHash.get(fill.hash)!.push(fill);
    });

    // Fusionner les fills avec le même hash
    return Array.from(fillsByHash.values()).map(hashFills => {
      if (hashFills.length === 1) return hashFills[0];

      const base = hashFills[0];
      const totalSize = hashFills.reduce((sum, fill) => sum + Number(fill.sz), 0);
      const totalFee = hashFills.reduce((sum, fill) => sum + Number(fill.fee), 0);

      return {
        ...base,
        sz: totalSize.toString(),
        fee: totalFee.toString()
      };
    });
  }

  async getUserTransactions(address: string): Promise<FormattedUserTransaction[]> {
    try {
      const [transactionsResponse, ledgerUpdates, fills] = await Promise.all([
        this.getUserTransactionsRaw(address),
        this.getUserNonFundingLedgerUpdates(address),
        this.getUserFills(address)
      ]);

      // Traiter d'abord les fills car ce sont les données les plus précises
      const fillTransactions = this.mergeFillsByHash(fills || []).map(fill => ({
        hash: fill.hash,
        method: fill.dir,
        age: this.formatAge(fill.time),
        from: address,
        to: "HIP-2",
        amount: fill.sz,
        token: fill.coin,
        price: fill.px,
        total: (Number(fill.px) * Number(fill.sz)).toFixed(2)
      }));

      // Créer un Set des hashs déjà traités par les fills
      const processedHashes = new Set(fillTransactions.map(tx => tx.hash));

      const ledgerMap = new Map(
        ledgerUpdates.map((update) => [update.hash, update])
      );
      
      // Traiter les autres transactions qui n'ont pas de fills correspondants
      const otherTransactions = transactionsResponse.txs
        .filter((tx: UserTransaction) => {
          // Ignorer les transactions déjà traitées par les fills
          if (processedHashes.has(tx.hash)) {
            return false;
          }
          // Ignorer les transactions evmRawTx sans montant
          if (tx.action.type === "evmRawTx" && !tx.action.orders?.[0]?.s) {
            return false;
          }
          return true;
        })
        .map((tx: UserTransaction) => {
          const order = tx.action.orders?.[0];
          const ledgerUpdate = ledgerMap.get(tx.hash);

          if (ledgerUpdate) {
            return {
              hash: tx.hash,
              method: ledgerUpdate.delta.type,
              age: this.formatAge(tx.time),
              from: address,
              to: tx.action.destination || "0x2222222222222222222222222222222222222222",
              amount: ledgerUpdate.delta.type === "withdraw" || ledgerUpdate.delta.type === "accountClassTransfer" 
                ? ledgerUpdate.delta.usdc || "0"
                : ledgerUpdate.delta.amount || ledgerUpdate.delta.usdc || "0",
              token: ledgerUpdate.delta.type === "withdraw" || ledgerUpdate.delta.type === "accountClassTransfer"
                ? "USDC"
                : ledgerUpdate.delta.token || ledgerUpdate.delta.coin || "unknown"
            };
          }

          // Reste du code existant pour les autres types de transactions...
          let amount = "0";
          if (order?.s) {
            amount = order.s;
          } else if (tx.action.type === "SystemSpotSendAuction" && tx.action.wei) {
            amount = (Number(tx.action.wei) / 100000000).toString();
          } else if (tx.action.amount !== undefined) {
            amount = tx.action.amount;
          }

          if (tx.action.type === "evmRawTx") {
            return {
              hash: tx.hash,
              method: "transfer",
              age: this.formatAge(tx.time),
              from: address,
              to: "HyperEVM",
              amount,
              token: order?.a?.toString() || tx.action.token || "unknown"
            };
          }

          if (tx.action.type === "SystemSpotSendAction") {
            return {
              hash: tx.hash,
              method: tx.action.type,
              age: this.formatAge(tx.time),
              from: "0x2222222222222222222222222222222222222222",
              to: address,
              amount,
              token: tx.action.token || "unknown"
            };
          }

          if (tx.action.type === "spotSend") {
            return {
              hash: tx.hash,
              method: tx.action.type,
              age: this.formatAge(tx.time),
              from: address,
              to: tx.action.destination || "0x2222222222222222222222222222222222222222",
              amount,
              token: tx.action.token || "unknown"
            };
          }

          return {
            hash: tx.hash,
            method: tx.action.type,
            age: this.formatAge(tx.time),
            from: address,
            to: tx.action.destination || "0x2222222222222222222222222222222222222222",
            amount,
            token: order?.a?.toString() || tx.action.token || "unknown"
          };
        });

      // Combiner les fills avec les autres transactions et trier par timestamp (plus récent en premier)
      return [...fillTransactions, ...otherTransactions].sort((a, b) => {
        const timeA = new Date(a.age.replace(' ago', '')).getTime();
        const timeB = new Date(b.age.replace(' ago', '')).getTime();
        return timeA - timeB;
      });
    } catch (error) {
      console.error("Error formatting user transactions:", error);
      throw error;
    }
  }
} 