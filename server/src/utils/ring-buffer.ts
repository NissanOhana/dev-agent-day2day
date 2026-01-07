// Ring buffer for keeping last N items in memory

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private writeIndex = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    const start = this.count < this.capacity ? 0 : this.writeIndex;

    for (let i = 0; i < this.count; i++) {
      const index = (start + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }

    return result;
  }

  getRecent(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.writeIndex = 0;
    this.count = 0;
  }

  size(): number {
    return this.count;
  }
}
