import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { RepublishPendingTransactions } from '../application/republish-pending-transactions.use-case';

/** Intervalo entre passadas; recuperação em segundos sem pesar na tabela. */
export const SWEEP_INTERVAL_MS = 5_000;
/** Só o que está pendente há mais que isto é republicado; o resto ainda pode estar em voo. */
export const PENDING_GRACE_MS = 10_000;

@Injectable()
export class PendingSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PendingSweeper.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly republish: RepublishPendingTransactions) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Uma passada; público para os testes chamarem sem esperar o intervalo. */
  async sweep(now: Date = new Date()): Promise<number> {
    try {
      const republished = await this.republish.execute(new Date(now.getTime() - PENDING_GRACE_MS));
      if (republished > 0) {
        this.logger.log(
          `Republished transaction.created for ${republished} pending transaction(s)`,
        );
      }
      return republished;
    } catch (error) {
      this.logger.error(`Sweep failed: ${String(error)}`);
      return 0;
    }
  }
}
