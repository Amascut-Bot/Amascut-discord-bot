import { Message, MessageType } from 'discord.js';
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
