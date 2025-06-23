import { RateLimitData } from 'discord.js';

import BotEvent from '../types/BotEvent';

export default class Ratelimit extends BotEvent {
    get name() {
        return 'rateLimit';
    }

    get fireOnce() {
        return false;
    }

    get enabled() {
        return true;
    }

    async run(info: RateLimitData) {
        this.client.logger.log(
            {
                handler: this.constructor.name,
                message:
                    '\n' +
                    `  Route                    : ${info.route}\n` +
                    `  Hash                     : ${info.hash}\n` +
                    `  Max Requests             : ${info.limit}\n` +
                    `  Timeout                  : ${info.timeToReset}ms\n` +
                    `  Global Ratelimit         : ${info.global}`,
            },
            true
        );
    }
}
