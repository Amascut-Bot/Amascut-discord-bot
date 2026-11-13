import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class StopGMTimer extends BotInteraction {
    get name() {
        return 'stop-gmtimer';
    }

    get description() {
        return 'Disable and clear the GM timer signup queue';
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
        return CAQueueHandler.stopQueue(this.client, interaction, 'gmtimer');
    }
}
