
import { asIsoDateTime, type IsoDateTime } from './brand.js';

export interface Clock {
  now(): IsoDateTime;
}

export class SystemClock implements Clock {
  public now(): IsoDateTime {
    return asIsoDateTime(new Date().toISOString());
  }
}

export class FixedClock implements Clock {
  public constructor(private readonly value: IsoDateTime) {}

  public now(): IsoDateTime {
    return this.value;
  }
}
