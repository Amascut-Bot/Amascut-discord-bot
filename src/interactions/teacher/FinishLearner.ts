import HostHandler from '../../modules/HostHandler';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default class FinishLearner extends BotInteraction {
    get name() {
        return 'finish-learner';
    }

    get description() {
        return 'Finish a learner hour';
    }

    get permissions() {
        return 'TEACHER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        return new HostHandler(this.client, 'host_learner_quickfinish', interaction);
    }
}
