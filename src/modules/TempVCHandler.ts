import { ParentChannelOptions, TempChannelsManager, TempChannelsManagerEvents } from '@hunteroi/discord-temp-channels';
import Bot from '../Bot';
import { getChannels } from '../GuildSpecifics';
import { DiscordAPIError, VoiceState, ChannelType, PermissionFlagsBits } from 'discord.js';

export default interface TempChannelManager {
    client: Bot;
    built: boolean;
    on(eventName: TempChannelsManagerEvents, listener: (...args: unknown[]) => void | Promise<void>): this;
}

export default class TempChannelManager extends TempChannelsManager {
    public client: Bot;
    public built: boolean;
    constructor(client: Bot) {
        super(client);
        this.client = client;
        this.built = false;
        // this.on(TempChannelsManagerEvents.error, (err) => console.log('[TempManager]', err))
        // this.on(TempChannelsManagerEvents.channelRegister, (parent) => console.log('Registered', parent));
        // this.on(TempChannelsManagerEvents.channelUnregister, (parent) => console.log('Unregistered', parent));
        // this.on(TempChannelsManagerEvents.childAdd, (child, parent) => console.log('Child added!', child, parent));
        // this.on(TempChannelsManagerEvents.childRemove, (child, parent) => console.log('Child removed!', child, parent));
        // this.on(TempChannelsManagerEvents.childPrefixChange, (child) => console.log('Prefix changed', child));
        
        // Add custom voice state change handler for fallback logic
        this.setupCustomVoiceHandler();
        this.loaded();
    }

    private setupCustomVoiceHandler(): void {
        this.client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
            const channels = getChannels(process.env.GUILD_ID);
            
            // Check if user joined the temp VC create channel
            if (newState.channelId === channels.tempVCCreate && !oldState.channelId) {
                await this.handleTempVCCreation(newState);
            }
        });
    }

    private async handleTempVCCreation(voiceState: VoiceState): Promise<void> {
        const channels = getChannels(process.env.GUILD_ID);
        const member = voiceState.member;
        
        if (!member || !voiceState.guild) return;

        try {
            // Check if user already has a temp VC
            const existingChannels = voiceState.guild.channels.cache.filter(channel => 
                channel.name.includes(member.displayName) && 
                (channel.parentId === channels.tempVCCategory || channel.parentId === channels.tempVCCategory2)
            );

            if (existingChannels.size > 0) {
                // Move user to their existing channel
                const existingChannel = existingChannels.first();
                if (existingChannel && existingChannel.type === ChannelType.GuildVoice) {
                    await member.voice.setChannel(existingChannel);
                    return;
                }
            }

            // Try to create new temp VC with fallback logic
            const newChannel = await this.createTempVCWithFallback(member);
            if (newChannel) {
                // Move user to the new channel
                await member.voice.setChannel(newChannel);
            }

        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Failed to handle temp VC creation for ${member.user.tag}`,
                error: error as Error
            });
        }
    }

    private async createTempVCWithFallback(member: any): Promise<any> {
        const channels = getChannels(process.env.GUILD_ID);
        const guild = member.guild;
        
        // Get current channel count for naming
        const allTempChannels = guild.channels.cache.filter((channel: any) => 
            channel.name.match(/^Team #\d+ \|/) && 
            (channel.parentId === channels.tempVCCategory || channel.parentId === channels.tempVCCategory2)
        );
        const channelCount = allTempChannels.size + 1;
        const channelName = `Team #${channelCount} | ${member.displayName}`;

        try {
            // Try primary category first
            const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
            if (primaryCategory && 'children' in primaryCategory) {
                const primaryChannelCount = primaryCategory.children.cache.size;
                
                if (primaryChannelCount < 50) {
                    return await this.createTempChannel(guild, channelName, channels.tempVCCategory, member, 'primary');
                }
            }

            // Primary is full, try secondary
            const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
            if (secondaryCategory && 'children' in secondaryCategory) {
                const secondaryChannelCount = secondaryCategory.children.cache.size;
                
                if (secondaryChannelCount < 50) {
                    this.client.logger.log({
                        handler: this.constructor.name,
                        message: `Primary temp VC category full, using secondary category for ${member.user.tag}`
                    }, true);
                    return await this.createTempChannel(guild, channelName, channels.tempVCCategory2, member, 'secondary');
                }
            }

            // Both categories are full
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Both temp VC categories are full! Cannot create channel for ${member.user.tag}`,
                error: new Error('All temp VC categories at capacity')
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

    private async createTempChannel(guild: any, channelName: string, categoryId: string, member: any, categoryType: string): Promise<any> {
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

            // Set up auto-delete when empty
            this.setupChannelCleanup(channel);

            return channel;

        } catch (error) {
            if (error instanceof DiscordAPIError && error.code === 50035) {
                this.client.logger.error({
                    handler: this.constructor.name,
                    message: `Category ${categoryType} is full when trying to create channel for ${member.user.tag}`,
                    error: error
                });
            }
            throw error;
        }
    }

    private setupChannelCleanup(channel: any): void {
        // Check every 30 seconds if channel is empty
        const cleanup = setInterval(async () => {
            try {
                const updatedChannel = await this.client.channels.fetch(channel.id);
                if (updatedChannel && updatedChannel.type === ChannelType.GuildVoice && 'members' in updatedChannel) {
                    const memberCount = (updatedChannel as any).members.size;
                    if (memberCount === 0) {
                        await updatedChannel.delete('Temp VC auto-cleanup: empty channel');
                        clearInterval(cleanup);
                        this.client.logger.log({
                            handler: this.constructor.name,
                            message: `Auto-deleted empty temp VC: ${channel.name}`
                        }, true);
                    }
                }
            } catch (error) {
                // Channel might already be deleted
                clearInterval(cleanup);
            }
        }, 30000);
    }

    public __initParentListener(channelId: string, options?: ParentChannelOptions): void {
        // Do not register with the original library - we're using custom voice state handling
        // The custom handler in setupCustomVoiceHandler() will handle all temp VC creation
        this.client.logger.log({
            handler: this.constructor.name,
            message: `Temp VC create channel ${channelId} configured with custom fallback system`
        }, true);
    }



    public loaded(): void {
        this.built = true;
        this.client.logger.log({ handler: this.constructor.name, message: 'Loaded handler for TempVC' }, true)
        return void 0;
    }
}
