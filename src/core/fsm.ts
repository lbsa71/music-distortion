import { AppState } from './config.js';

export type StateTransition = {
  from: AppState;
  to: AppState;
  condition?: () => boolean;
};

export class StateMachine {
  private currentState: AppState = 'BOOT';
  private transitions: Map<string, AppState[]> = new Map();
  private listeners: Map<AppState, (() => void)[]> = new Map();

  constructor() {
    // Define valid state transitions
    this.transitions.set('BOOT', ['IDLE']);
    this.transitions.set('IDLE', ['FADE_IN']);
    this.transitions.set('FADE_IN', ['RUN']);
    this.transitions.set('RUN', ['TRANSITION', 'FADE_OUT']);
    this.transitions.set('TRANSITION', ['RUN', 'FADE_OUT']);
    this.transitions.set('FADE_OUT', ['BLACK']);
    this.transitions.set('BLACK', ['FADE_IN']);
  }

  getCurrentState(): AppState {
    return this.currentState;
  }

  canTransition(to: AppState): boolean {
    const validTransitions = this.transitions.get(this.currentState);
    return validTransitions ? validTransitions.includes(to) : false;
  }

  transitionTo(state: AppState): boolean {
    if (!this.canTransition(state)) {
      console.warn(`Invalid transition from ${this.currentState} to ${state}`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = state;
    
    console.log(`State transition: ${previousState} -> ${state}`);
    
    // Notify listeners
    const listeners = this.listeners.get(state);
    if (listeners) {
      listeners.forEach(listener => listener());
    }

    return true;
  }

  onStateEnter(state: AppState, callback: () => void): void {
    if (!this.listeners.has(state)) {
      this.listeners.set(state, []);
    }
    this.listeners.get(state)!.push(callback);
  }

  reset(): void {
    this.currentState = 'BOOT';
  }
}