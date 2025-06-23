import isMaster from 'cluster';
import { webhookUrl } from '../../config.json';
import { WebhookClient } from 'discord.js';

export default interface BotLogger {
    webhookUrl: typeof webhookUrl;
    webhook: WebhookClient;
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
        this.webhookUrl = webhookUrl ?? null;
        if (!this.webhookUrl) throw new Error('Webhook URL is missing in config file.');
        this.webhook = new WebhookClient({ url: webhookUrl });
        this.webhook.send('Health check initialized').catch((reason) => console.log(reason));
    }

    private webhook_formatter(incoming: BotLog | BotError): string {
        return `\`\`\`json\n${JSON.stringify(incoming, null, 2)}\n\`\`\``;
    }

    get id() {
        return isMaster ? 'Parent' : process.env.CLUSTER_ID;
    }

    public log(incoming: BotLog, webhook_enabled: boolean): void {
        const _format: string = JSON.stringify(incoming, null, 2);
        webhook_enabled ? this.webhook.send(this.webhook_formatter(incoming)) : void 0;
        return console.log('[INFO]', _format);
    }

    public error(incoming: BotError): void {
        const _format: string = JSON.stringify(incoming, null, 2);
        this.webhook.send(this.webhook_formatter(incoming));
        return console.log('[ERROR]', _format);
    }
}
