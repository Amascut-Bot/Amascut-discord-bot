import { EmbedBuilder, Message, MessageType } from 'discord.js';
import BotEvent from '../types/BotEvent';
import TicketHandler from '../modules/TicketHandler';

export default class MessageCreate extends BotEvent {
    get name() {
        return 'messageCreate';
    }

    get fireOnce() {
        return false;
    }

    get enabled() {
        return true;
    }

    async run(message: Message): Promise<any> {
        if (this.client.util.ignoredChannels.includes(message.channel.id)) return;
        if (message.author.id === this.client.user?.id) return;
        if (message.author.bot) return;
        if (message.webhookId) return;
        if (!message.inGuild()) return;
        if (this.client.util.config.guildMessageDisabled.includes(message.guild.id)) return;

        // Auto-delete pin notification system messages
        if (message.type === MessageType.ChannelPinnedMessage) {
            try {
                if (!message.reference || !message.reference.messageId) return;
                // Fetch the message that was actually pinned
                const pinnedMessage = await message.channel.messages.fetch(message.reference.messageId);

                if (!this.client.user) return;

                // Check if the bot pinned the message and if the content contains the trigger phrase
                if (pinnedMessage.author.id === this.client.user.id && pinnedMessage.content.includes('.pin:delete')) {
                    await message.delete();
                    this.client.logger.log({ message: `Auto-deleted pin notification for bot-pinned message in channel ${message.channel.id}` }, true);
                }
            } catch (error) {
                this.client.logger.error({
                    message: `Failed to process pin notification system message in channel ${message.channel.id}`,
                    error: error as Error
                });
            }
            return;
        }

        if (await this.client.autoTrigger.customAutomod(message)) {
            return;
        }

        // Handle guild-specific auto-triggers
        if (await this.client.autoTrigger.handleAutoTriggers(message)) {
            return;
        }

        // Handle URL reactions
        if (await this.client.urlReactionHandler.handleURLReactions(message)) {
            return;
        }

        // Handle VOD submissions
        if (message.channel.id === this.client.channelIds.vodSubmissions) {
            try {
                const vodReviewChannel = await this.client.channels.fetch(this.client.channelIds.vodReview);
                if (!vodReviewChannel || !('send' in vodReviewChannel)) {
                    this.client.logger.error({
                        message: 'VOD review channel not found or cannot send messages',
                        handler: this.constructor.name,
                        error: new Error('Invalid channel type')
                    });
                    return;
                }

                const urls: string[] = [];
                const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

                let contentWithoutUrls = message.content || '';
                if (message.content) {
                    const extractedUrls = message.content.match(urlRegex) || [];
                    urls.push(...extractedUrls);
                    contentWithoutUrls = message.content.replace(urlRegex, '').trim();
                }

                if (message.attachments.size > 0) {
                    for (const [_, attachment] of message.attachments) {
                        const reuploaded = await this.client.util.reuploadImage(attachment.url, attachment.name);
                        urls.push(reuploaded);
                    }
                }

                const vodEmbed = new EmbedBuilder()
                    .setTitle('Vod:')
                    .setColor(this.client.color)
                    .setDescription(contentWithoutUrls || 'No description provided')
                    .setFooter({ 
                        text: `Author: @${message.author.username}`,
                    })
                    .setTimestamp(message.createdAt);

                if (message.author.avatarURL()) {
                    vodEmbed.setAuthor({
                        name: message.author.displayName,
                        iconURL: message.author.avatarURL() || undefined
                    });
                }

                await vodReviewChannel.send({ embeds: [vodEmbed] });

                if (urls.length > 0) {
                    await vodReviewChannel.send(urls.join('\n\n'));
                }

                await message.delete();

                this.client.logger.log({
                    message: `Forwarded VOD submission from ${message.author.tag} to review channel`,
                    handler: this.constructor.name
                }, true);

            } catch (error) {
                this.client.logger.error({
                    message: `Failed to forward VOD submission from ${message.author.tag}`,
                    handler: this.constructor.name,
                    error: error as Error
                });
            }
            return;
        }

        // Handle !myvc command
        if (message.content.trim().toLowerCase() === '!myvc') {
            try {
                const member = message.member;
                if (!member) return;

                const voiceChannel = member.voice.channel;
                if (!voiceChannel) {
                    return message.reply('You need to be in a voice channel to use this command!');
                }

                // Create an invite to the voice channel
                const invite = await voiceChannel.createInvite({
                    maxAge: 0, // Never expires
                    maxUses: 0, // Unlimited uses
                    unique: false, // Don't create a unique invite every time
                    reason: `!myvc command by ${message.author.tag}`
                });

                return message.reply(`Voice channel: ${invite.url}`);
            } catch (error) {
                this.client.logger.error({
                    message: `Failed to create voice channel invite for !myvc command by ${message.author.tag} in channel ${message.channel.id}`,
                    handler: this.constructor.name,
                    error: error as Error
                });
                return message.reply('Sorry, I couldn\'t create an invite to your voice channel. Make sure I have the "Create Instant Invite" permission!');
            }
        }

        // Report-Message-Sync
        if (message.channel.name.toLowerCase().startsWith('report') || message.channel.name.toLowerCase().startsWith('clearance')) {
            await TicketHandler.SyncMessage(this.client, message);
        }
    }
}
