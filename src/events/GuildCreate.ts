import { Guild } from 'discord.js';
import BotEvent from '../types/BotEvent';

export default class GuildCreate extends BotEvent {
    get name() {
        return 'guildCreate';
    }

    get fireOnce() {
        return false;
    }

    get enabled() {
        return true;
    }

    async run(guild: Guild): Promise<void> {
        this.client.logger.log(
            {
                handler: this.constructor.name,
                message: `Joined guild **${guild.name}** with **${guild.memberCount}** members.`,
            },
            true
        );
    }
}
