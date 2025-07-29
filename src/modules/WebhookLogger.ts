import { EmbedBuilder } from 'discord.js';

export default class WebhookLogger {
    private infoWebhookUrl: string;
    private errorWebhookUrl: string;
    private infoQueue: any[] = [];
    private isSending: boolean = false;

    constructor() {
        if (!process.env.INFO_WEBHOOK_URL || !process.env.ERROR_WEBHOOK_URL) {
            console.warn('[WebhookLogger] INFO_WEBHOOK_URL or ERROR_WEBHOOK_URL not found in .env file. Webhook logging will be disabled.');
            this.infoWebhookUrl = '';
            this.errorWebhookUrl = '';
        } else {
            this.infoWebhookUrl = process.env.INFO_WEBHOOK_URL.trim();
            this.errorWebhookUrl = process.env.ERROR_WEBHOOK_URL.trim();
            setInterval(() => this.sendInfoBatch(), 5000); // Send batches every 5 seconds
        }
    }

    private serializeMessage(message: any): string {
        if (typeof message === 'string') {
            return message;
        }

        const replacer = (key: string, value: any) => {
            if (value instanceof Error) {
                const plainError: { [key: string]: any } = {};
                Object.getOwnPropertyNames(value).forEach((prop) => {
                    plainError[prop] = (value as any)[prop];
                });
                // Ensure name is captured, as it can be on the prototype
                if (!plainError.name) {
                    plainError.name = value.name;
                }
                return plainError;
            }
            return value;
        };

        return JSON.stringify(message, replacer, 2);
    }

    public logInfo(message: any): void {
        if (!this.infoWebhookUrl) return;
        this.infoQueue.push(message);
    }

    public async logError(message: any): Promise<void> {
        if (!this.errorWebhookUrl) return;

        const content = this.serializeMessage(message);
        const chunks = this.chunkMessage(content, 1980); // 1980 to leave space for code block
        for (const chunk of chunks) {
            try {
                await fetch(this.errorWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `\`\`\`json\n${chunk}\n\`\`\``,
                        username: 'ERROR Logs',
                    }),
                });
            } catch (error) {
                console.error('[WebhookLogger] Failed to send ERROR log to webhook:', error);
            }
        }
    }

    private chunkMessage(message: string, limit: number): string[] {
        const chunks: string[] = [];
        let currentChunk = '';
        for (const line of message.split('\n')) {
            if (currentChunk.length + line.length + 1 > limit) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        return chunks;
    }

    private async sendInfoBatch(): Promise<void> {
        if (this.infoQueue.length === 0 || this.isSending) {
            return;
        }

        this.isSending = true;

        const batch = this.infoQueue.splice(0, this.infoQueue.length);
        const content = batch.map((msg) => this.serializeMessage(msg)).join('\n');
        const chunks = this.chunkMessage(content, 1980);

        for (const chunk of chunks) {
            try {
                await fetch(this.infoWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `\`\`\`json\n${chunk}\n\`\`\``,
                        username: 'INFO Logs',
                    }),
                });
            } catch (error) {
                console.error('[WebhookLogger] Failed to send INFO batch to webhook:', error);
            }
        }

        this.isSending = false;
    }
}
