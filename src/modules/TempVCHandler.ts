import { ParentChannelOptions, TempChannelsManager, TempChannelsManagerEvents } from '@hunteroi/discord-temp-channels';
import Bot from '../Bot';

export default interface TempChannelManager {
    client: Bot;
    built: boolean;
    on(eventName: TempChannelsManagerEvents, listener: (...args: unknown[]) => void | Promise<void>): this;
}

export default class TempChannelManager extends TempChannelsManager {
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
        return this.registerChannel(channelId, options || {
            childCategory: this.client.util.channels.tempVCCategory,
            childAutoDeleteIfEmpty: true,
            childAutoDeleteIfParentGetsUnregistered: true,
            childAutoDeleteIfOwnerLeaves: false,
            childVoiceFormat: (str, count): string => `Team #${count} | ${str}`,
            // childVoiceFormat: (str, count): string => `${str}'s Team`,
            childVoiceFormatRegex: /^Team #\d+ \|/,
            // childVoiceFormatRegex: /^.*\'s\s{1}Team$/,
            childBitrate: 64000
        })
    }

    public loaded(): void {
        this.built = true;
        this.client.logger.log({ handler: this.constructor.name, message: 'Loaded handler for TempVC' }, false)
        return void 0;
    }
}
