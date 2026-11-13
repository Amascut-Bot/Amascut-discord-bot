import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class NextGMTimer extends BotInteraction {
    get name() {
        return 'next-gmtimer';
    }

    get description() {
        return 'Remove the first person from the GM timer queue and show who is next';
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
        return CAQueueHandler.nextInQueue(this.client, interaction, 'gmtimer');
    }
}
