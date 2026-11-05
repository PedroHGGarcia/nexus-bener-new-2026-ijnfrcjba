export class ProposalSectionCounter {
  private level1 = 0
  private level2 = 0

  nextLevel1(title?: string): string {
    this.level1 += 1
    this.level2 = 0
    return title ? `${this.level1}. ${title}` : `${this.level1}.`
  }

  nextLevel2(title?: string): string {
    this.level2 += 1
    const prefix = `${this.level1}.${this.level2}`
    return title ? `${prefix} ${title}` : prefix
  }

  getCurrentLevel1(): number {
    return this.level1
  }

  getCurrentLevel2(): number {
    return this.level2
  }

  reset(): void {
    this.level1 = 0
    this.level2 = 0
  }
}

export function createSectionCounter(): ProposalSectionCounter {
  return new ProposalSectionCounter()
}
