import { Message } from 'discord.js';
import BotEvent from '../types/BotEvent';

export default class MessageUpdate extends BotEvent {
    get name() {
        return 'messageUpdate';
    }

    get fireOnce() {
        return false;
    }

    get enabled() {
        return true;
    }

    async run(oldMessage: Message, newMessage: Message): Promise<any> {
        const teamformingChannels = [this.client.channelIds.reminderChannel1, this.client.channelIds.reminderChannel2, this.client.channelIds.reminderChannel3, this.client.channelIds.reminderChannel4];

        if (teamformingChannels.includes(newMessage.channelId) && (newMessage.content.toLowerCase().includes('keep') || newMessage.content.toLowerCase().includes('keeps')) && 'send' in newMessage.channel) {
            await newMessage.channel.send(`<@${newMessage.member?.id}> use <#1413114658541539410> for keeps!`);
            await newMessage.delete();
            return;
        }
    }
}
