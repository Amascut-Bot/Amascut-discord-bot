import { GuildChannel, Message } from 'discord.js';
import Bot from '../Bot';

export default class AutoTriggerHandler {
    private client: Bot;

    private static readonly MEOW_REPLY_CHANCE = 50;
    private static readonly TAUNT_CHANCE = 10;

    private static readonly tauntMessages = [
        'YOUR SOUL IS MINE!',
        'Well, well. I see the menagerie is all here.',
        'Silence!',
        'I AM. THE GOD. OF. DESTRUCTION.',
        'Your soul is WEAK.',
        'I will not be denied.',
        'It is NOT over!'
    ];

    constructor(client: Bot) {
        this.client = client;
    }

    async handleAutoTriggers(message: Message): Promise<boolean> {
        if (message.guild?.id !== process.env.GUILD_ID) return false;

        if (!await this.handleYoink(message)) return true;

        if (await this.checkTauntTriggers(message)) return true;

        if (message.mentions.has(this.client.user!.id)) {
            return await this.handleMentions(message);
        }

        return false;
    }

    private async checkTauntTriggers(message: Message): Promise<boolean> {
        const msg = message.content.toLowerCase();

        if (!msg.includes('meow') && !msg.includes(':meow:') && !msg.includes(':hehe:')) {
            return false;
        }

        const meowEmoji = this.client.emojiCache.get('meow');
        const heheEmoji = this.client.emojiCache.get('hehe');
        let triggered = false;

        if (meowEmoji && message.content.includes(meowEmoji.toString())) triggered = true;
        if (heheEmoji && message.content.includes(heheEmoji.toString())) triggered = true;
        if (/\bmeow/i.test(message.content)) triggered = true;

        if (triggered && Math.floor(Math.random() * AutoTriggerHandler.TAUNT_CHANCE) === 0) {
            await message.reply('Do you believe yourself to be amusing, pest? Or do you long for annihilation so dearly?');
            return true;
        }

        return false;
    }

    private async handleMentions(message: Message): Promise<boolean> {
        // Don't respond to build commands
        if (message.content.toLowerCase().includes('build')) {
            return false;
        }

        if (Math.floor(Math.random() * AutoTriggerHandler.MEOW_REPLY_CHANCE) === 0) {
            const emoji = this.client.emojiCache.get('meow');
            const roleId = process.env.MEOW_ROLE_ID || '1390696959630774302';
            const role = await message.guild!.roles.fetch(roleId);

            if (emoji && role && message.member && !message.member.roles.cache.has(roleId)) {
                try {
                    await message.member.roles.add(role);
                    this.client.logger.log({
                        message: `Assigned 'meow' role to ${message.author.tag}.`,
                        handler: this.constructor.name
                    }, true);
                } catch (error) {
                    this.client.logger.error({
                        message: `Failed to assign 'meow' role to ${message.author.tag}.`,
                        error,
                        handler: this.constructor.name
                    });
                }
            }

            if (emoji) {
                await message.reply({ content: emoji.toString() });
                return true;
            }
        }

        await message.reply(AutoTriggerHandler.tauntMessages[Math.floor(Math.random() * AutoTriggerHandler.tauntMessages.length)]);
        return true;
    }

    private async handleYoink(message: Message): Promise<boolean> {
        // only react to yoink
        if (!message.content.toLowerCase().includes('yoink')) {
            return true;
        }

        const messageMatch = message.content.match(/(?<=yoink\s).*/g);

        // yoink
        if (message.content.startsWith(`<@${this.client.user?.id}> yoink `) && message.member!.permissions.has('ManageEmojisAndStickers')) {
            let emojiMentionMatch = message.content.match(/<a?:\w+:\d+>/g);

            // if yoink is not directly an emoji but only its name lookup the last 20 messages for someone to post the emoji
            if (!emojiMentionMatch) {
                const messages = await message.channel.messages.fetch( { limit: 20 });


                if (messageMatch) {
                    const regex = new RegExp(`<a?:${messageMatch[0]}:\\d+>`);
                    messages.some(msg => {
                        emojiMentionMatch = msg.content.match(regex);

                        if (emojiMentionMatch) {
                            return true;
                        }
                        return false;
                    });
                }
            }

            if (emojiMentionMatch) {
                const isGif = emojiMentionMatch[0].startsWith('<a:');
                const emojiNameMatch = emojiMentionMatch ? emojiMentionMatch[0].match(/:(\w+):/) : '';
                const emojiIdMatch = emojiMentionMatch ? emojiMentionMatch[0].match(/:(\d+)>/) : '';

                if (emojiNameMatch && emojiIdMatch) {
                    const emojiName = emojiNameMatch[1];
                    const emojiId = emojiIdMatch[1];
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isGif ? 'gif' : 'png'}`;

                    await message.guild!.emojis.create({
                        name: emojiName,
                        attachment: emojiUrl
                    });

                    await message.reply(`yoinked!`);
                    return false;
                }
            }

            // if user provided an url with an image / gif, upload from that url
            if (!emojiMentionMatch && messageMatch) {
                const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/;
                if (urlRegex.test(messageMatch[0])) {
                    const emoji = await message.guild!.emojis.create({
                        name: 'upload_emoji',
                        attachment: messageMatch[0]
                    });

                    await message.reply(`uploaded <${emoji.animated ? 'a' : ''}:upload_emoji:${emoji.id}>!`);
                    return false;
                }
            }
        }

        return true;
    }
}
