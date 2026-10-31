/** Canonical UUID syntax for durable Supabase lease tokens.
 * Rejects the 36-hyphen and unseparated-hex strings admitted by a loose length regex. */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const validLeaseToken = value => typeof value === 'string' && UUID.test(value);
