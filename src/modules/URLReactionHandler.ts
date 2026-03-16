import { Message } from 'discord.js';
import Bot from '../Bot';

export default class URLReactionHandler {
    private client: Bot;

    constructor(client: Bot) {
        this.client = client;
    }

    async handleURLReactions(message: Message): Promise<boolean> {
        if (message.channel.id !== this.client.channelIds.cutePets && message.channel.id !== this.client.channelIds.achievements) {
            return false;
        }

        if (!this.containsURL(message.content) && !(message.attachments?.size > 0)) {
            return false;
        }

        try {
            if (message.channel.id === this.client.channelIds.cutePets) {
                await message.react('❤️');

                const emojis = ['cute', 'bulbaOWO'];

                for (let index = 0; index < emojis.length; index++) {
                    const emoji = await this.client.emojiCache.get(emojis[index]);

                    if (emoji) {
                        await message.react(emoji);
                    }
                }
            }
            else if (message.channel.id === this.client.channelIds.achievements) {
                const emojis = ['POGSLIDECOG', 'hypers'];

                for (let index = 0; index < emojis.length; index++) {
                    const emoji = await this.client.emojiCache.get(emojis[index]);

                    if (emoji) {
                        await message.react(emoji);
                    }
                }
            }

            this.client.logger.log({
                message: `Added URL reactions to message ${message.id}`,
                handler: this.constructor.name
            }, true);

            return true;
        } catch (error) {
            this.client.logger.error({
                message: `Failed to add URL reactions to message ${message.id}`,
                error: error as Error,
                handler: this.constructor.name
            });

            return false;
        }
    }

    private containsURL(text: string): boolean {
        const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/gi;
        return urlPattern.test(text);
    }
}
