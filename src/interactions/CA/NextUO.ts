import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class NextUO extends BotInteraction {
    get name() {
        return 'next_uo';
    }

    get description() {
        return 'Remove the first person from the Unorthodox queue and show who is next';
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
        return CAQueueHandler.nextInQueue(this.client, interaction, 'uo');
    }
}
