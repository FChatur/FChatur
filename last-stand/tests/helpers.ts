import { BALANCE, type BalanceConfig } from '../src/config/balance';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { Simulation, type SimulationOptions } from '../src/core/Simulation';

export const STEP = 1 / 60;

/** A run with optional balance overrides. Seeded (default 1) so every test is reproducible. */
export function makeSim(overrides: Partial<BalanceConfig> = {}, options: Omit<SimulationOptions, 'balance'> = {}) {
  const bus = new EventBus<GameEvents>();
  const sim = new Simulation(bus, { seed: 1, ...options, balance: { ...BALANCE, ...overrides } });
  return { bus, sim };
}

/** Steps until the predicate holds or the time budget runs out. Returns seconds simulated. */
export function runUntil(sim: Simulation, done: () => boolean, maxSeconds = 600): number {
  let t = 0;
  while (!done() && t < maxSeconds) {
    sim.step(STEP);
    t += STEP;
  }
  return t;
}
