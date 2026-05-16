const CANCEL = Symbol("Cancel");

export class CancellationToken {
  private _isCancelled = false;

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  [CANCEL](): void {
    this._isCancelled = true;
  }
}

export class CancellationTokenSource {
  token = new CancellationToken();

  cancel(): void {
    this.token[CANCEL]();
  }
}
