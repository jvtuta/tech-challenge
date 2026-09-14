/**
 * Orçamento de reentregas de uma mensagem. O transporte reentrega sempre o mesmo offset até o
 * handler completar, e cada partição processa um offset por vez, então basta guardar o offset
 * em curso de cada partição: quando ele avança, a contagem recomeça e o mapa nunca cresce além
 * do número de partições atribuídas ao consumidor.
 */
export class RedeliveryBudget {
  private readonly inFlightByPartition = new Map<string, { offset: string; deliveries: number }>();

  constructor(private readonly maxDeliveries: number) {}

  /** Registra mais uma entrega do offset e diz se o orçamento acabou. */
  spend(
    topic: string,
    partition: number,
    offset: string,
  ): { deliveries: number; exhausted: boolean } {
    const key = `${topic}:${partition}`;
    const inFlight = this.inFlightByPartition.get(key);
    const deliveries = inFlight?.offset === offset ? inFlight.deliveries + 1 : 1;
    const exhausted = deliveries >= this.maxDeliveries;
    if (exhausted) {
      this.inFlightByPartition.delete(key);
    } else {
      this.inFlightByPartition.set(key, { offset, deliveries });
    }
    return { deliveries, exhausted };
  }
}
