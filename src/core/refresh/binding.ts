import { AuthConfig, SessionMetadata, AuthError, AuthErrorCode } from '../../types';

// validate token binding against stored metadata
export function validateTokenBinding(
  stored: { userAgent?: string; ip?: string; deviceId?: string },
  current: SessionMetadata | undefined,
  config: AuthConfig
): void {
  if (!config.session?.binding || !current) {
    return;
  }

  const binding = config.session.binding;

  if (binding.userAgent && stored.userAgent && current.userAgent) {
    if (stored.userAgent !== current.userAgent) {
      throw new AuthError(AuthErrorCode.TOKEN_BINDING_MISMATCH, 'User agent mismatch', {
        expected: stored.userAgent,
        received: current.userAgent,
      });
    }
  }

  if (binding.ip && stored.ip && current.ip) {
    if (stored.ip !== current.ip) {
      throw new AuthError(AuthErrorCode.TOKEN_BINDING_MISMATCH, 'IP address mismatch', {
        expected: stored.ip,
        received: current.ip,
      });
    }
  }

  if (binding.deviceId && stored.deviceId && current.deviceId) {
    if (stored.deviceId !== current.deviceId) {
      throw new AuthError(AuthErrorCode.TOKEN_BINDING_MISMATCH, 'Device ID mismatch', {
        expected: stored.deviceId,
        received: current.deviceId,
      });
    }
  }
}
