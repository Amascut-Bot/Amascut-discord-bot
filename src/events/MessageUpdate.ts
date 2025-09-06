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
        // Handle guild-specific auto-triggers
        if (await this.client.autoTrigger.handleAutoTriggers(newMessage)) {
            return;
        }
    }
}
