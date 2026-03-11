import type { ProviderMode } from '../../shared/src/index';

export interface ProviderConfig {
  mode: ProviderMode;
}

export function getSupportedProviderModes(): ProviderMode[] {
  return ['local', 'byok-remote', 'custom-base-url'];
}

export function canSendRemoteContent(config: ProviderConfig): boolean {
  return config.mode !== 'local';
}
