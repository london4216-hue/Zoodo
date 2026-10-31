/** Validate bounded JSON callback envelope before dispatch. */
export function decodeCallbackEnvelope(body) {
  if (typeof body !== 'string' || Buffer.byteLength(body) > 8192) return {statusCode:413,error:'invalid payload'};
  let value;
  try { value=JSON.parse(body); } catch { return {statusCode:400,error:'invalid JSON'}; }
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.type !== 'string' || !value.type.trim()) return {statusCode:400,error:'invalid callback envelope'};
  return {value};
}
