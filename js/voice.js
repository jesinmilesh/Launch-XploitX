/**
 * voice.js — Voice Reader Disabled per User Request
 * No TTS reading of processing states.
 */

class HackerVoice {
  constructor() {
    this.enabled = false;
  }
  state() {}
  say() {}
  stop() {}
  setEnabled() {}
}

export const voice = new HackerVoice();
