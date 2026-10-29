import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class Next4K extends BotInteraction {
    get name() {
        return 'next_4k';
    }

    get description() {
        return 'Remove the first person from the 4K queue and show who is next';
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
        return CAQueueHandler.nextInQueue(this.client, interaction, '4k');
    }
}
