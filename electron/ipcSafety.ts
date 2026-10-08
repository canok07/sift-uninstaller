const object = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: unknown, allowed: string[]) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f]/.test(value);
const options = (value: unknown, booleans: string[], extra: string[] = []) => value === undefined ||
  (keys(value, [...booleans, ...extra]) && booleans.every(key => value[key] === undefined || typeof value[key] === 'boolean'));
export const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Reject unknown fields and oversized inputs before touching state or subprocesses.
export function validIPC(channel: string, args: unknown[]): boolean {
  if (['programs:get-installed', 'programs:get-uninstall-activity', 'app:get-system-info', 'logs:open-folder', 'backups:list'].includes(channel)) return args.length === 0;
  if (args.length !== 1) return false;
  const value = args[0] as any;
  switch (channel) {
    case 'programs:uninstall': return keys(value, ['appId', 'options']) && text(value.appId)
      && options(value.options, ['silent'], ['expectedRevision']) && text(value.options?.expectedRevision);
    case 'leftovers:scan': return keys(value, ['appId', 'options']) && text(value.appId) && options(value.options, ['scanAppData', 'scanRegistry']);
    case 'leftovers:delete': return keys(value, ['items']) && Array.isArray(value.items) && value.items.length <= 500
      && value.items.every((item: any) => keys(item, ['id']) && text(item.id));
    case 'system:create-restore-point': return keys(value, ['description']) && (value.description === undefined || text(value.description, 200));
    case 'programs:get-icon': return keys(value, ['appId', 'revision']) && text(value.appId) && text(value.revision);
    case 'programs:cancel-uninstall-wait': return keys(value, ['operationId']) && uuid(value.operationId);
    case 'backups:restore': return keys(value, ['id']) && uuid(value.id);
    case 'logs:renderer-error': return keys(value, ['kind', 'message', 'stack']) && typeof value.message === 'string' && value.message.length <= 4000
      && (value.stack === undefined || (typeof value.stack === 'string' && value.stack.length <= 8000)) && ['error', 'unhandledrejection', 'react'].includes(value.kind);
    default: return false;
  }
}
