
import { ParentChannelOptions, TempChannelsManager, TempChannelsManagerEvents } from '@hunteroi/discord-temp-channels';
import Bot from '../Bot';
import { getChannels } from '../GuildSpecifics';
import { DiscordAPIError, VoiceState, ChannelType, PermissionFlagsBits, GuildMember } from 'discord.js';

export default interface TempChannelManager {
    client: Bot;
    built: boolean;
    on(eventName: TempChannelsManagerEvents, listener: (...args: unknown[]) => void | Promise<void>): this;
}

export default class TempChannelManager extends TempChannelsManager {
    public client: Bot;
    public built: boolean;
    private tempChannelIds: Set<string>;

    constructor(client: Bot) {
        super(client);
        this.client = client;
        this.built = false;
        this.tempChannelIds = new Set();

        this.setupVoiceStateListener();
        this.loaded();
    }

    private setupVoiceStateListener(): void {
        this.client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
            const channels = getChannels(process.env.GUILD_ID);

            // User joins the "create" channel
            if (newState.channelId === channels.tempVCCreate && newState.member) {
                await this.handleTempVCCreation(newState);
            }

            // User leaves a voice channel
            if (oldState.channel && oldState.channelId !== channels.tempVCCreate) {
                this.handleTempVCDeletion(oldState);
            }
        });
    }

    private async handleTempVCCreation(voiceState: VoiceState): Promise<void> {
        const member = voiceState.member as GuildMember;
        const guild = voiceState.guild;

        if (!member || !guild) return;

        try {
            // Check if user already has a temp VC
            for (const channelId of this.tempChannelIds) {
                const channel = guild.channels.cache.get(channelId);
                if (channel && channel.name.includes(member.displayName)) {
                    await member.voice.setChannel(channel.id);
                    return;
                }
            }

            // Create a new temp VC
            const newChannel = await this.createTempVCWithFallback(member);
            if (newChannel) {
                await member.voice.setChannel(newChannel);
                this.tempChannelIds.add(newChannel.id);
            }

        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Failed to handle temp VC creation for ${member.user.tag}`,
                error: error as Error
            });
        }
    }

    private async createTempVCWithFallback(member: GuildMember): Promise<any> {
        const channels = getChannels(process.env.GUILD_ID);
        const guild = member.guild;

        const existingTempChannels = guild.channels.cache.filter(c => this.tempChannelIds.has(c.id));
        const channelCount = existingTempChannels.size + 1;
        const channelName = `Team #${channelCount} | ${member.displayName}`;

        try {
            const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
            if (primaryCategory && primaryCategory.type === ChannelType.GuildCategory && primaryCategory.children.cache.size < 50) {
                return await this.createTempChannel(guild, channelName, channels.tempVCCategory, member, 'primary');
            }

            const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
            if (secondaryCategory && secondaryCategory.type === ChannelType.GuildCategory && secondaryCategory.children.cache.size < 50) {
                return await this.createTempChannel(guild, channelName, channels.tempVCCategory2, member, 'secondary');
            }

            const tertiaryCategory = await this.client.channels.fetch(channels.tempVCCategory3);
            if (tertiaryCategory && tertiaryCategory.type === ChannelType.GuildCategory && tertiaryCategory.children.cache.size < 50) {
                return await this.createTempChannel(guild, channelName, channels.tempVCCategory3, member, 'tertiary');
            }

            this.client.logger.error({
                handler: this.constructor.name,
                message: `Both temp VC categories are full! Cannot create channel for ${member.user.tag}`,
                error: new Error('Both temp VC categories are full!')
            });
            return null;

        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Error creating temp VC for ${member.user.tag}`,
                error: error as Error
            });
            return null;
        }
    }

    private async createTempChannel(guild: any, channelName: string, categoryId: string, member: GuildMember, categoryType: string): Promise<any> {
        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: categoryId,
                bitrate: 64000,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.Stream,
                            PermissionFlagsBits.UseVAD,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });
            this.client.logger.log({
                handler: this.constructor.name,
                message: `Created temp VC "${channelName}" in ${categoryType} category for ${member.user.tag}`
            }, true);
            return channel;

        } catch (error) {
            if (error instanceof DiscordAPIError && error.code === 50035) { // Max number of channels in category
                 this.client.logger.error({
                    handler: this.constructor.name,
                    message: `Category ${categoryType} is full when trying to create channel for ${member.user.tag}`,
                    error: error
                });
            }
            throw error;
        }
    }

    private async handleTempVCDeletion(oldState: VoiceState): Promise<void> {
        const channel = oldState.channel;

        if (channel && this.tempChannelIds.has(channel.id) && channel.members.size === 0) {
            try {
                await channel.delete('Temp VC auto-cleanup: empty channel');
                this.tempChannelIds.delete(channel.id);
                this.client.logger.log({
                    handler: this.constructor.name,
                    message: `Auto-deleted empty temp VC: ${channel.name}`
                }, true);
            } catch (error) {
                // Channel might have been deleted already
                if (error instanceof DiscordAPIError && error.code === 10003) {
                    this.tempChannelIds.delete(channel.id);
                } else {
                    this.client.logger.error({
                        handler: this.constructor.name,
                        message: `Failed to delete temp VC: ${channel.name}`,
                        error: error as Error
                    });
                }
            }
        }
    }

    public __initParentListener(channelId: string, options?: ParentChannelOptions): void {
        this.client.logger.log({
            handler: this.constructor.name,
            message: `Temp VC create channel ${channelId} configured with custom fallback system`
        }, true);
    }

    public loaded(): void {
        this.built = true;
        this.client.logger.log({ handler: this.constructor.name, message: 'Loaded handler for TempVC' }, true);
    }
}
