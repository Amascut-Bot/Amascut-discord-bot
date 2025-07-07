import isMaster from 'cluster';
import WebhookLogger from './WebhookLogger';

export default interface BotLogger {
    webhookLogger: WebhookLogger;
}

export type BotLog = {
    uid?: string;
    args?: unknown;
    handler?: string;
    user?: string;
    message: string;
    error?: unknown;
};

export type BotError = {
    handler?: string;
    message?: string;
    debug?: unknown;
    error: unknown;
};

export default class BotLogger {
    constructor() {
        this.webhookLogger = new WebhookLogger();
    }

    get id() {
        return isMaster ? 'Parent' : process.env.CLUSTER_ID;
    }

    public log(incoming: BotLog, webhook_enabled: boolean): void {
        const _format: string = JSON.stringify(incoming, null, 2);
        if (webhook_enabled) {
            this.webhookLogger.logInfo(incoming);
        }
        return console.log('[INFO]', _format);
    }

    public error(incoming: BotError): void {
        this.webhookLogger.logError(incoming);
        const _format: string = JSON.stringify(incoming, null, 2);
        return console.log('[ERROR]', _format);
    }
}
