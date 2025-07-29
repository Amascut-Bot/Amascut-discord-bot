import { Message } from 'discord.js';
import Bot from '../Bot';
import { getChannels } from '../GuildSpecifics';

export default class URLReactionHandler {
    private client: Bot;
    private static readonly URL_REACTION_CHANNEL_ID = getChannels(process.env.GUILD_ID).MUSIC_CHANNEL;

    constructor(client: Bot) {
        this.client = client;
    }

    async handleURLReactions(message: Message): Promise<boolean> {
        if (message.channel.id !== URLReactionHandler.URL_REACTION_CHANNEL_ID) {
            return false;
        }

        if (!this.containsURL(message.content)) {
            return false;
        }

        try {
            await message.react('👍');
            await message.react('👎');

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
