import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class WipeQueue extends BotInteraction {
    get name() {
        return 'wipe-uo-queue';
    }

    get description() {
        return 'Clear the Combat Achievement signup queue';
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
        return CAQueueHandler.wipeQueue(this.client, interaction, 'uo');
    }
}
