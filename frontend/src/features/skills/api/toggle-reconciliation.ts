export interface ToggleInvalidationDecision {
  invalidateList: boolean;
  invalidateSkill: boolean;
}

export class ToggleReconciliationTracker {
  private totalInFlight = 0;
  private inFlightBySkill = new Map<string, number>();

  begin(skillRef: string): void {
    this.totalInFlight += 1;
    this.inFlightBySkill.set(skillRef, (this.inFlightBySkill.get(skillRef) ?? 0) + 1);
  }

  finish(skillRef: string): ToggleInvalidationDecision {
    const currentForSkill = this.inFlightBySkill.get(skillRef) ?? 0;

    if (currentForSkill <= 0 || this.totalInFlight <= 0) {
      this.totalInFlight = 0;
      this.inFlightBySkill.delete(skillRef);
      return {
        invalidateList: true,
        invalidateSkill: true,
      };
    }

    const nextForSkill = currentForSkill - 1;
    if (nextForSkill <= 0) {
      this.inFlightBySkill.delete(skillRef);
    } else {
      this.inFlightBySkill.set(skillRef, nextForSkill);
    }

    this.totalInFlight -= 1;

    return {
      invalidateList: this.totalInFlight === 0,
      invalidateSkill: nextForSkill === 0,
    };
  }
}
