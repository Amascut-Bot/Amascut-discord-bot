import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import CAQueueHandler from '../../modules/CAQueueHandler';

export default class StartPerf extends BotInteraction {
    get name() {
        return 'start-perf';
    }

    get description() {
        return 'Enable the performance signup queue';
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
        return CAQueueHandler.startQueue(this.client, interaction, 'perf');
    }
}
