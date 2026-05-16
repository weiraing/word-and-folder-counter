export class DebugHelper {
  debugMode = false;
  private idCounter = 0;

  setDebugMode(debug: boolean): void {
    this.debugMode = debug;
  }

  debug(...args: unknown[]): void {
    if (!this.debugMode) return;
    console.log("novel-word-count:", ...args);
  }

  error(message: string): void {
    if (!this.debugMode) return;
    console.error(message);
  }

  debugStart(name: string): () => void {
    if (!this.debugMode) {
      return () => {};
    }
    const qualifiedName = `novel-word-count|${name} (${++this.idCounter})`;
    console.time(qualifiedName);
    return () => console.timeEnd(qualifiedName);
  }
}
