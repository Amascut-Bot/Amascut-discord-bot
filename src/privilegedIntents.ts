/// <reference types="node" />

/**
 * GuildMembers and MessageContent are privileged. Discord rejects the
 * websocket identify if the application has not been approved for them.
 *
 * Default: off in production, on everywhere else.
 * Override with PRIVILEGED_INTENTS=true|false.
 */
export function usePrivilegedIntents(): boolean {
    const environment = (process.env.ENVIRONMENT ?? '').toLowerCase();
    const isProduction = environment === 'production' || environment === 'prod';
    const override = process.env.PRIVILEGED_INTENTS?.toLowerCase();

    if (override === 'true') return true;
    if (override === 'false') return false;
    return !isProduction;
}
