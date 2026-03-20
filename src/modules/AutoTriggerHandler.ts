import { MediaGalleryBuilder, Message, MessageFlags, SeparatorSpacingSize, TextChannel } from 'discord.js';
import Bot from '../Bot';
import { MessageShortcut } from '../entity/MessageShortcut';
import UtilityHandler from './UtilityHandler';

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

    private static readonly meowMessages = [
        'Do you believe yourself to be amusing, pest? Or do you long for annihilation so dearly?',
        'Again with this insolence?'
    ];

    private static readonly whitelistedTauntChannels = [
        '1389393102258573475', //nm
        '1403494299903066142', //enr push
        '1389393146647154808', //enr farm
        '1401385848993222866', //verified
        '1389392657939173396', //clown activity
        '1389379873348255864', //general
        '1389416608274976839', //theorycrafting
        '1391157147626246204', //bot spam
    ];

    constructor(client: Bot) {
        this.client = client;
    }

    async handleAutoTriggers(message: Message): Promise<boolean> {
        if (await this.handleShortcuts(message)) return true;

        if (message.guild?.id !== process.env.GUILD_ID) return false;

        if (await this.handleKeeps(message)) return true;

        if (!await this.handleYoink(message)) return true;

        // only taunt in specific channels if prod guild
        if (message.guild?.id !== '885457551397912596' || AutoTriggerHandler.whitelistedTauntChannels.includes(message.channel.id)) {
            if (await this.checkTauntTriggers(message)) return true;

            if (message.mentions.has(this.client.user!.id)) {
                return await this.handleMentions(message);
            }
        }

        if (message.author.id === '561059859290652672' && message.content.includes('...')) {
            await message.reply('...');
            return true;
        }

        return false;
    }

    private async checkTauntTriggers(message: Message): Promise<boolean> {
        const msg = message.content.toLowerCase();

        if (!msg.includes('meow') && !msg.includes(':meow:') && !msg.includes(':hehe:')) {
            return false;
        }
        //alex is cute
        //patze is cute
        const meowEmoji = this.client.emojiCache.get('meow');
        const heheEmoji = this.client.emojiCache.get('hehe');
        let triggered = false;

        if (meowEmoji && message.content.includes(meowEmoji.toString())) triggered = true;
        if (heheEmoji && message.content.includes(heheEmoji.toString())) triggered = true;
        if (/\bmeow/i.test(message.content)) triggered = true;

        if (triggered && Math.floor(Math.random() * AutoTriggerHandler.TAUNT_CHANCE) === 0) {
            await message.reply(AutoTriggerHandler.meowMessages[Math.floor(Math.random() * AutoTriggerHandler.meowMessages.length)]);
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
            const roleId = this.client.roleIds.MEOW_ROLE;
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

        const messageMatch = message.content.match(/(?<=yoink\s).*/gi);

        // yoink
        if (message.content.startsWith(`<@${this.client.user?.id}> yoink `) && message.member!.permissions.has('ManageEmojisAndStickers')) {
            let emojiMentionMatch = message.content.match(/<a?:\w+:\d+>/gi);

            // if yoink is not directly an emoji but only its name lookup the last 20 messages for someone to post the emoji
            if (!emojiMentionMatch) {
                const messages = await message.channel.messages.fetch({ limit: 20 });


                if (messageMatch) {
                    const regex = new RegExp(`<a?:${messageMatch[0]}:\\d+>`, 'gi');
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
                const emojiNameMatch = emojiMentionMatch ? emojiMentionMatch[0].match(/:(\w+):/i) : '';
                const emojiIdMatch = emojiMentionMatch ? emojiMentionMatch[0].match(/:(\d+)>/i) : '';

                if (emojiNameMatch && emojiIdMatch) {
                    const emojiName = emojiNameMatch[1];
                    const emojiId = emojiIdMatch[1];
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isGif ? 'gif' : 'png'}`;

                    const emoji = await message.guild!.emojis.create({
                        name: emojiName,
                        attachment: emojiUrl
                    });

                    await message.reply(`yoinked <${emoji.animated ? 'a' : ''}:upload_emoji:${emoji.id}>!`);
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

    private async handleShortcuts(message: Message): Promise<boolean> {
        const { dataSource } = this.client;
        const repository = dataSource.getRepository(MessageShortcut);
        //TODO: make global caching

        const match = message.content.match(/^[^\s\r\n]+/gm);

        if (match) {
            const existingEntry = await repository.findOne({
                where: {
                    guildId: message.guild!.id,
                    shortcut: match[0]
                }
            });

            if (existingEntry) {
                try {
                    const guild = await this.client.guilds.fetch(existingEntry.message_guildId);

                    if (guild) {
                        const channel = await guild.channels.fetch(existingEntry.message_channelId) as TextChannel;

                        if (channel) {
                            const messageToSend = await channel.messages.fetch(existingEntry.message_messageId);

                            if (messageToSend) {
                                await (message.channel as TextChannel).send({
                                    content: messageToSend.content,
                                    embeds: messageToSend.embeds,
                                    components: messageToSend.components,
                                    flags: messageToSend.flags.has(MessageFlags.IsComponentsV2) ? MessageFlags.IsComponentsV2 : undefined,
                                    allowedMentions: { "parse" : [] }
                                });
                                return true;
                            } else {
                                this.client.logger.log({ message: `Could not find message with id: ${existingEntry.message_messageId} in channel with id: ${existingEntry.message_channelId} in guild with id: ${existingEntry.message_guildId}.`, handler: 'AutoTriggerHandler'}, true);
                            }
                        } else {
                            this.client.logger.log({ message: `Could not find channel with id: ${existingEntry.message_channelId} in guild with id: ${existingEntry.message_guildId}.`, handler: 'AutoTriggerHandler'}, true);
                        }
                    } else {
                        this.client.logger.log({ message: `Could not find guild with id: ${existingEntry.message_guildId}.`, handler: 'AutoTriggerHandler'}, true);
                    }
                } catch (error) {
                    this.client.logger.log({ message: 'Error retrieving shortcut data', error: error, handler: 'AutoTriggerHandler' }, true);
                }
            }
        }

        return false;
    }

    private static readonly keepsKeywords = [
        'keeps',
        'keep',
        'kep',
    ];

    private async handleKeeps(message: Message): Promise<boolean> {
        const teamformingChannels = [this.client.channelIds.casualTeams];

        if (teamformingChannels.includes(message.channelId) && (AutoTriggerHandler.keepsKeywords.some((keyword) => { return message.content.toLowerCase().includes(keyword)})) && 'send' in message.channel) {
            if (await this.client.util.hasRolePermissionsMessage(this.client, ['admin', 'owner'], message)) return false;

            await message.channel.send(`<@${message.member?.id}> use <#${this.client.channelIds.splitsOnly}> for keeps!`);
            await message.delete();
            return true;
        }
        return false;
    }

    //#region Automod

    public async customAutomod(message: Message): Promise<boolean> {
        if (!message.inGuild()) return false;
        if (message.guildId !== process.env.GUILD_ID) return false;

        if (await this.client.util.hasRolePermissionsMessage(this.client, ['admin', 'owner'], message)) return false;

        const adminChannelId = this.client.channelIds.admin;
        const adminChannel = await this.client.channels.fetch(adminChannelId) as TextChannel;

        const banChannelId = this.client.channelIds.autoBanLogs;
        const banChannel = await this.client.channels.fetch(banChannelId) as TextChannel;

        let duration = "1d";

        let automodResult = UtilityHandler.checkAutomod(message.content);

        if (!(automodResult.ban || automodResult.timeout)) {
            for (const [_, attachment] of message.attachments) {
                automodResult = UtilityHandler.checkAutomod(attachment.url)

                if (automodResult.ban || automodResult.timeout) break;
            }
        }

        if (automodResult.timeout || automodResult.ban) {
            const container = this.client.cv2.getContainerBuilder(false, "Suspicious Account");
            container.addTextDisplayComponents(builder => builder.setContent(`${message.member?.user.tag} (<@${message.member?.id}>) was automatically ${automodResult.ban ? 'banned' : 'timeouted'}.\n\n**Evidence:** \`${automodResult.evidence}\`\n\n**Reason:** \`${automodResult.reason}\`\n\n**Reference:** ${message.url}`));

            if (message.content) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
                container.addTextDisplayComponents(builder => builder.setContent('Message Content:'));
                container.addTextDisplayComponents(builder => builder.setContent(message.content));
            }

            if (message.attachments?.size > 0) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
                container.addTextDisplayComponents(builder => builder.setContent('Message Attachments:'));

                const mediaGalleryBuilder = new MediaGalleryBuilder();

                for (const [_, attachment] of message.attachments) {
                    const newUrl = await this.client.util.reuploadImage(attachment.url);
                    mediaGalleryBuilder.addItems(item => item.setURL(newUrl));
                }

                container.addMediaGalleryComponents(mediaGalleryBuilder);
            }

            if (automodResult.ban) {
                await banChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse" : [] }});

                await message.member!.ban({ reason: automodResult.reason, deleteMessageSeconds: 604800 }).then(() => {
                    this.client.logger.log({ message: `Automatically banned user with id ${message.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}` }, true)
                }).catch((err) => {
                    this.client.logger.error({ message: `Error banning user with id ${message.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}`, error: err.stack });
                });
            } else {
                await adminChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse" : [] }});

                const { timeout } = this.client.util;
                const timeoutUser = timeout.bind(this.client.util);

                if (await timeoutUser(null, message.member!, duration, automodResult.reason)) {
                    this.client.logger.log({ message: `Automatically timeouted user with id ${message.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}` }, true);
                } else {
                    this.client.logger.error({ message: `Automatically timeouted user with id ${message.member?.id} for reason ${automodResult.reason} with evidence ${automodResult.evidence}`, error: null });
                }
            }

            try {
                // Delete the channel after a short delay
                setTimeout(async () => {
                    await message.delete().catch(() => {});
                }, 2500);
            } catch (error) {
                //do nothing, message was already deleted
            }
        }

        return false;
    }

    //#endregion
}
