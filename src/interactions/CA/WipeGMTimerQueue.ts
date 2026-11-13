import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class WipeGMTimerQueue extends BotInteraction {
    get name() {
        return 'wipe-gmtimer-queue';
    }

    get description() {
        return 'Clear the GM timer signup queue';
    }

    get permissions() {
        return 'CAHELPER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        return CAQueueHandler.wipeQueue(this.client, interaction, 'gmtimer');
    }
}
