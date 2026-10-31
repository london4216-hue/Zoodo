/** A kick is not a success when its dispatch has no durable confirmation. */
export function kickHttpStatus(result) {
  if (!result || typeof result !== 'object') return 503;
  return ['dispatched', 'delegated', 'idle'].includes(result.state) ? 200 : 503;
}
