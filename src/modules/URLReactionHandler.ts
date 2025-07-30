import { Message } from 'discord.js';
import Bot from '../Bot';
import { getChannels } from '../GuildSpecifics';

export default class URLReactionHandler {
    private client: Bot;
    private static readonly MUSIC_CHANNEL_ID = getChannels(process.env.GUILD_ID).MUSIC_CHANNEL;
    private static readonly CUTE_PETS_CHANNEL_ID = getChannels(process.env.GUILD_ID).CUTE_PETS_CHANNEL;
    private static readonly achievementsAndLogs = getChannels(process.env.GUILD_ID).achievementsAndLogs;

    constructor(client: Bot) {
        this.client = client;
    }

    async handleURLReactions(message: Message): Promise<boolean> {
        if (message.channel.id !== URLReactionHandler.MUSIC_CHANNEL_ID && message.channel.id !== URLReactionHandler.CUTE_PETS_CHANNEL_ID && message.channel.id !== URLReactionHandler.achievementsAndLogs) {
            return false;
        }

        if (!this.containsURL(message.content)) {
            return false;
        }

        try {
            if (message.channel.id === URLReactionHandler.MUSIC_CHANNEL_ID) {
                await message.react('👍');
                await message.react('👎');
            }
            else if (message.channel.id === URLReactionHandler.CUTE_PETS_CHANNEL_ID) {
                await message.react('❤️');

                const emojis = ['cute', 'bulbaOWO'];

                for (let index = 0; index < emojis.length; index++) {
                    const emoji = await this.client.emojiCache.get(emojis[index]);

                    if (emoji) {
                        await message.react(emoji);
                    }
                }
            }
            else if (message.channel.id === URLReactionHandler.achievementsAndLogs) {
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
