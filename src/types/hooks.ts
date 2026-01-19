import { TokenPayload } from './auth';
import { SessionMetadata } from './session';

export interface AuthHooks {
  onLogin?: (payload: TokenPayload, metadata?: SessionMetadata) => void | Promise<void>;
  onRefresh?: (payload: TokenPayload, metadata?: SessionMetadata) => void | Promise<void>;
  onLogout?: (userId: string, sessionId?: string) => void | Promise<void>;
  onTokenRevoked?: (userId: string, sessionId?: string) => void | Promise<void>;
}
