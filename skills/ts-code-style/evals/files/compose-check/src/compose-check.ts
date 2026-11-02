export class TemplateError extends Error {}

export interface ConnectorService {
  readonly image?: string;
  readonly command?: readonly string[];
  readonly environment?: Readonly<Record<string, string>>;
  readonly read_only?: boolean;
  readonly privileged?: boolean;
  readonly ports?: readonly string[];
  readonly volumes?: readonly string[];
  readonly build?: string;
  readonly network_mode?: string;
  readonly cap_add?: readonly string[];
  readonly cap_drop?: readonly string[];
  readonly security_opt?: readonly string[];
}

const TOKEN_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

/**
 * Checks that a user-supplied Cloudflare connector service keeps the isolation the stock template
 * has, and returns its tunnel token.
 */
export function checkConnector(connector: ConnectorService): string {
  // Custom templates retain the connector's process and filesystem isolation.
  if (
    connector.read_only !== true ||
    connector.privileged ||
    connector.ports?.length ||
    connector.volumes?.length ||
    connector.build ||
    connector.network_mode ||
    connector.cap_add?.length ||
    !connector.cap_drop?.includes('ALL') ||
    !connector.security_opt?.includes('no-new-privileges:true')
  ) {
    throw new TemplateError('Invalid connector template');
  }

  const token = connector.environment?.TUNNEL_TOKEN;
  if (!token || /[\r\n\0]/.test(token) || !TOKEN_PATTERN.test(token)) {
    throw new TemplateError('The connector needs a single-line TUNNEL_TOKEN');
  }

  return token;
}
