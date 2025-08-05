import { ParentChannelOptions, TempChannelsManager, TempChannelsManagerEvents } from '@hunteroi/discord-temp-channels';
import Bot from '../Bot';
import { getChannels } from '../GuildSpecifics';
import { DiscordAPIError } from 'discord.js';

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
        this.loaded();
    }

    public __initParentListener(channelId: string, options?: ParentChannelOptions): void {
        const channels = getChannels(process.env.GUILD_ID);
        
        return this.registerChannel(channelId, options || {
            childCategory: channels.tempVCCategory,
            childAutoDeleteIfEmpty: true,
            childAutoDeleteIfParentGetsUnregistered: true,
            childAutoDeleteIfOwnerLeaves: true,
            childVoiceFormat: (str, count): string => `Team #${count} | ${str}`,
            // childVoiceFormat: (str, count): string => `${str}'s Team`,
            childVoiceFormatRegex: /^Team #\d+ \|/,
            // childVoiceFormatRegex: /^.*\'s\s{1}Team$/,
            childBitrate: 64000,
            childShouldBeCreated: async (member, parent) => {
                try {
                    // Try primary category first
                    const primaryCategory = await this.client.channels.fetch(channels.tempVCCategory);
                    if (primaryCategory && primaryCategory.isThread() === false && 'children' in primaryCategory) {
                        const channelCount = primaryCategory.children.cache.size;
                        if (channelCount < 50) {
                            return { shouldCreate: true, reason: 'Primary category available' };
                        }
                    }
                    
                    // If primary is full, try secondary category
                    const secondaryCategory = await this.client.channels.fetch(channels.tempVCCategory2);
                    if (secondaryCategory && secondaryCategory.isThread() === false && 'children' in secondaryCategory) {
                        const channelCount = secondaryCategory.children.cache.size;
                        if (channelCount < 50) {
                            // Override the category for this creation
                            parent.options.childCategory = channels.tempVCCategory2;
                            this.client.logger.log({
                                handler: this.constructor.name,
                                message: `Primary temp VC category full (50 channels), using secondary category for ${member.user.tag}`
                            }, true);
                            return { shouldCreate: true, reason: 'Using secondary category' };
                        }
                    }
                    
                    // Both categories are full
                    this.client.logger.error({
                        handler: this.constructor.name,
                        message: `Both temp VC categories are full! Cannot create channel for ${member.user.tag}`,
                        error: new Error('All temp VC categories at capacity')
                    });
                    return { shouldCreate: false, reason: 'All categories full' };
                    
                } catch (error) {
                    this.client.logger.error({
                        handler: this.constructor.name,
                        message: 'Error checking temp VC category capacity',
                        error: error as Error
                    });
                    return { shouldCreate: true, reason: 'Error checking capacity, allowing creation' };
                }
            }
        })
    }

    public loaded(): void {
        this.built = true;
        this.client.logger.log({ handler: this.constructor.name, message: 'Loaded handler for TempVC' }, true)
        return void 0;
    }
}
