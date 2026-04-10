export interface ScopedInvalidationDecision {
  invalidateAll: boolean;
  invalidateScope: boolean;
}

export class ScopedReconciliationTracker<Scope extends string> {
  private totalInFlight = 0;
  private inFlightByScope = new Map<Scope, number>();

  begin(scope: Scope): void {
    this.totalInFlight += 1;
    this.inFlightByScope.set(scope, (this.inFlightByScope.get(scope) ?? 0) + 1);
  }

  finish(scope: Scope): ScopedInvalidationDecision {
    const currentForScope = this.inFlightByScope.get(scope) ?? 0;

    if (currentForScope <= 0 || this.totalInFlight <= 0) {
      this.totalInFlight = 0;
      this.inFlightByScope.delete(scope);
      return {
        invalidateAll: true,
        invalidateScope: true,
      };
    }

    const nextForScope = currentForScope - 1;
    if (nextForScope <= 0) {
      this.inFlightByScope.delete(scope);
    } else {
      this.inFlightByScope.set(scope, nextForScope);
    }

    this.totalInFlight -= 1;

    return {
      invalidateAll: this.totalInFlight === 0,
      invalidateScope: nextForScope === 0,
    };
  }
}
